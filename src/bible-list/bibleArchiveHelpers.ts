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
import Bible from './Bible';

/**
 * A bible list (`.owb`) as a self-contained `.owbible.tar.gz` bundle, using the
 * same generic single-item bundle as a document
 * (`src/helper/singleItemArchiveHelpers.ts`).
 *
 * A bible list holds VERSE REFERENCES, not text, so the file itself is tiny and
 * the only thing hanging off it is the background attached to the list or to
 * one of its verses — which is exactly what the shared collector already picks
 * up through the `.bg.json` sidecar. Per-verse color notes need no manifest
 * entry either: `ItemBase` keeps them inside each item's own `metadata`, so they
 * travel inside the file.
 *
 * The bible VERSIONS the verses name are not bundled — they are large,
 * separately downloaded data files. A verse whose version is missing on the
 * other machine renders as unavailable until that version is downloaded there,
 * the same as any other verse of a version you do not have.
 */

export const BIBLE_ARCHIVE_DOT_EXTENSION = '.owbible.tar.gz';

const CONFIG: SingleItemArchiveConfigType = {
    itemKind: 'bible',
    dotExtension: BIBLE_ARCHIVE_DOT_EXTENSION,
    fallbackName: 'Bible List',
    workDirPrefix: 'owbible',
    exportTitle: 'Export Bible List',
    importTitle: 'Import Bible List',
    urlLabel: 'Bible List Archive URL:',
    itemLabel: 'bible list',
    // NOT a constant: the reader page keeps its own bible-list folder, so the
    // destination has to be asked for at import time rather than baked into
    // `kindDirSettingNameMap`.
    getItemDirSettingName: () => {
        return Bible.getDirSourceSettingName();
    },
};

export function checkIsBibleArchiveFileFullName(fileFullName: string) {
    return checkIsSingleItemArchiveFileFullName(fileFullName, CONFIG);
}

export function createBibleArchive(
    filePath: string,
    password: string | null = null,
) {
    return createSingleItemArchive(filePath, CONFIG, password);
}

export function exportBible(filePath: string) {
    return exportSingleItem(filePath, CONFIG);
}

export function importBibleArchive(archiveFilePath: string) {
    return importSingleItemArchive(archiveFilePath, CONFIG);
}

export function selectAndImportBibleArchive() {
    return selectAndImportSingleItemArchive(CONFIG);
}

export function askAndImportBibleArchiveFromUrl() {
    return askAndImportSingleItemArchiveFromUrl(CONFIG);
}

export function importDroppedBibleArchive(file: DroppedFileType) {
    return importDroppedSingleItemArchive(file, CONFIG);
}
