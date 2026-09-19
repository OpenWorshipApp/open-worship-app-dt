import type { SingleItemArchiveConfigType } from '../helper/singleItemArchiveHelpers';
import {
    askAndImportSingleItemArchiveFromUrl,
    checkIsSingleItemArchiveFileFullName,
    createSingleItemArchive,
    exportSingleItem,
    importDroppedSingleItemArchive,
    importSingleItemArchive,
    selectAndImportSingleItemArchive,
} from '../helper/singleItemArchiveHelpers';
import type { DroppedFileType } from '../others/droppingFileHelpers';

/**
 * A whole document — an Open Worship `.ows`, a lyric, or a PDF/PPTX/DOCX — as a
 * self-contained `.owadoc.tar.gz` bundle. Everything below is the generic
 * single-item bundle (`src/helper/singleItemArchiveHelpers.ts`), which in turn
 * shares all of its machinery with the presenting flow bundle; this file is only the
 * documents list's configuration of it.
 *
 * Any document kind works because the file is copied verbatim and only the JSON
 * kinds (`.ows` / `.preview`) are ever walked for canvas media — a lyric has no
 * canvas, and neither has an office document.
 */

export const APP_DOCUMENT_ARCHIVE_DOT_EXTENSION = '.owadoc.tar.gz';

const CONFIG: SingleItemArchiveConfigType = {
    itemKind: 'document',
    dotExtension: APP_DOCUMENT_ARCHIVE_DOT_EXTENSION,
    fallbackName: 'Document',
    workDirPrefix: 'owadoc',
    exportTitle: 'Export Document',
    importTitle: 'Import Document',
    urlLabel: 'Document Archive URL:',
    itemLabel: 'document',
};

export function checkIsAppDocumentArchiveFileFullName(fileFullName: string) {
    return checkIsSingleItemArchiveFileFullName(fileFullName, CONFIG);
}

export function createAppDocumentArchive(
    filePath: string,
    password: string | null = null,
) {
    return createSingleItemArchive(filePath, CONFIG, password);
}

export function exportAppDocument(filePath: string) {
    return exportSingleItem(filePath, CONFIG);
}

export function importAppDocumentArchive(archiveFilePath: string) {
    return importSingleItemArchive(archiveFilePath, CONFIG);
}

export function selectAndImportAppDocumentArchive() {
    return selectAndImportSingleItemArchive(CONFIG);
}

export function askAndImportAppDocumentArchiveFromUrl() {
    return askAndImportSingleItemArchiveFromUrl(CONFIG);
}

export function importDroppedAppDocumentArchive(file: DroppedFileType) {
    return importDroppedSingleItemArchive(file, CONFIG);
}
