import type {
    ArchiveBackgroundMetaType,
    ArchiveFileEntryType,
    ArchiveFileKindType,
} from './appArchiveHelpers';
import {
    ARCHIVE_VERSION,
    ArchiveFileCollector,
    PLAIN_ARCHIVE_TEMP_NAME,
    applyImportedCanvasMedia,
    checkIsArchiveFileFullName,
    createWorkDir,
    genNextArchiveFilePath,
    importArchiveFiles,
    importBackgroundMetas,
    readArchiveManifest,
    resolveKindDirPaths,
    safeDeleteDir,
    stageArchiveFiles,
    toArchiveDotExtension,
    toArchiveFileName,
    toArchiveFileNameFromUrl,
    validateArchiveBackgroundMetas,
    validateArchiveFileEntries,
    writeArchiveManifest,
} from './appArchiveHelpers';
import {
    askForNewArchivePassword,
    openArchiveForReading,
    protectArchiveFile,
} from './archivePasswordHelpers';
import DirSource from './DirSource';
import { handleError } from './errorHelpers';
import FileSource from './FileSource';
import {
    getColorNoteFilePathSettings,
    setColorNoteFilePathSettings,
} from './FileSourceMetaManager';
import { getAppFilePathFromFile } from './localFileHelpers';
import { initHttpRequest } from './bible-helpers/downloadHelpers';
import {
    askForURL,
    messageCallback,
    streamDownloadFile,
} from '../background/downloadHelper';
import { tran } from '../lang/langHelpers';
import type { DroppedFileType } from '../others/droppingFileHelpers';
import {
    hideProgressBar,
    showProgressBar,
} from '../progress-bar/progressBarHelpers';
import {
    showFileOrDirExplorer,
    tarCreate,
    tarExtract,
} from '../server/appHelpers';
import {
    fsCopyFilePathToPath,
    getDownloadPath,
    pathJoin,
    selectFiles,
} from '../server/fileHelpers';
import { showSimpleToast } from '../toast/toastHelpers';

/**
 * Export/import ONE list-item file as a self-contained bundle — a document
 * (`src/app-document-list/appDocumentArchiveHelpers.ts`) or a bible list
 * (`src/bible-list/bibleArchiveHelpers.ts`). It is the single-item counterpart
 * of the playlist bundle and shares all of its machinery via
 * `appArchiveHelpers`, so the two can never disagree about how files are
 * collected, where they land, or when a local one is reused.
 *
 * What rides along: the item file verbatim, its attached-background `.bg.json`
 * sidecar plus the media that sidecar points at, the media its own canvas
 * points at (a VIDEO box stores a path; an IMAGE box inlines its pixels and
 * needs nothing), and its color notes. The regenerable `<doc>.pdf-images/`,
 * `<doc>.pptx-htmls/` and `<doc>.histories/` are deliberately NOT bundled.
 */

export type SingleItemArchiveConfigType = {
    /** Which folder the item itself is written into on import. */
    itemKind: ArchiveFileKindType;
    dotExtension: string;
    /** Archive name when the item's own name sanitizes to nothing. */
    fallbackName: string;
    /** Temp work-dir prefix, e.g. `owadoc` → `owadoc-import-<uuid>`. */
    workDirPrefix: string;
    exportTitle: string;
    importTitle: string;
    /** Label of the URL prompt, e.g. `Document Archive URL:`. */
    urlLabel: string;
    /** How the item is named in an error message, e.g. `document`. */
    itemLabel: string;
    /**
     * The item's destination folder, when it is not the plain constant in
     * `kindDirSettingNameMap` (the bible list's folder differs per page).
     * Resolved BEFORE anything is written, like every other folder.
     */
    getItemDirSettingName?: () => string;
};

/**
 * `item` names the exporting machine's absolute path, which is the key `files`
 * entries are looked up by — so import finds the local copy of the item itself
 * exactly the way it finds every other bundled file. `itemKind` is what stops a
 * bible bundle from being imported as a document (and vice versa) when it is
 * picked through a file dialog rather than dropped.
 */
type ArchiveManifestType = {
    version: typeof ARCHIVE_VERSION;
    itemKind: ArchiveFileKindType;
    item: string;
    files: ArchiveFileEntryType[];
    backgroundMetas: ArchiveBackgroundMetaType[];
    colorNotes: { [key: string]: string };
};

export function toSingleItemArchiveFileName(
    name: string,
    config: SingleItemArchiveConfigType,
    password: string | null = null,
) {
    return toArchiveFileName(
        name,
        toArchiveDotExtension(config.dotExtension, password),
        config.fallbackName,
    );
}

export function checkIsSingleItemArchiveFileFullName(
    fileFullName: string,
    config: SingleItemArchiveConfigType,
) {
    return checkIsArchiveFileFullName(fileFullName, config.dotExtension);
}

export async function createSingleItemArchive(
    filePath: string,
    config: SingleItemArchiveConfigType,
    password: string | null = null,
) {
    const stagingDir = await createWorkDir(`${config.workDirPrefix}-export`);
    try {
        const collector = new ArchiveFileCollector();
        if (!(await collector.addDocument(filePath, config.itemKind))) {
            throw new Error(
                `Unable to read the ${config.itemLabel}: ${filePath}`,
            );
        }
        const { archiveFiles, archiveEntries } = await stageArchiveFiles(
            collector,
            stagingDir,
            [],
        );
        const manifest: ArchiveManifestType = {
            version: ARCHIVE_VERSION,
            itemKind: config.itemKind,
            item: filePath,
            files: archiveFiles,
            backgroundMetas: collector.backgroundMetas,
            // A non-app file (PDF/PPTX/DOCX) keeps its own color note in the
            // settings rather than inside the file, and EVERY document keeps
            // its per-slide notes there — none of that travels with the file
            // itself, so it is carried in the manifest.
            colorNotes: getColorNoteFilePathSettings(filePath),
        };
        await writeArchiveManifest(stagingDir, manifest);
        const fileSource = FileSource.getInstance(filePath);
        const archiveFilePath = await genNextArchiveFilePath(
            getDownloadPath(),
            toSingleItemArchiveFileName(fileSource.name, config, password),
            toArchiveDotExtension(config.dotExtension, password),
        );
        // Protecting one means tar writes into the staging dir instead — that
        // dir is deleted in `finally` either way, so the plain copy never
        // outlives the call and only the wrapped one reaches Downloads. It is
        // safe at the staging root: `archiveEntries` is an explicit list, so
        // tar never packs it.
        const plainFilePath = password
            ? pathJoin(stagingDir, PLAIN_ARCHIVE_TEMP_NAME)
            : archiveFilePath;
        await tarCreate(stagingDir, plainFilePath, archiveEntries, true);
        if (password) {
            return await protectArchiveFile(
                plainFilePath,
                archiveFilePath,
                password,
            );
        }
        return archiveFilePath;
    } finally {
        await safeDeleteDir(stagingDir);
    }
}

/**
 * Report a failed export/import and answer `null` for the caller to return.
 * Written once because the same three steps — log it, tell the operator in the
 * flow's own title, give back nothing — are what every entry point below does,
 * and a message that drifts between them reads as two different problems.
 */
function reportArchiveFailure(
    title: string,
    verb: 'export' | 'import',
    config: SingleItemArchiveConfigType,
    error: any,
) {
    handleError(error);
    showSimpleToast(
        title,
        error?.message ?? `Unable to ${verb} the ${config.itemLabel}`,
    );
    return null;
}

export async function exportSingleItem(
    filePath: string,
    config: SingleItemArchiveConfigType,
) {
    // Asked here rather than at the context-menu call sites, so every entry
    // point into this export gets the same one dialog and none of them had to
    // change. An empty answer means "no password" and writes exactly what this
    // export has always written; `null` means the whole export was cancelled.
    const password = await askForNewArchivePassword(config.exportTitle);
    if (password === null) {
        return null;
    }
    showProgressBar(config.exportTitle);
    try {
        const archiveFilePath = await createSingleItemArchive(
            filePath,
            config,
            password || null,
        );
        showSimpleToast(config.exportTitle, `Exported to ${archiveFilePath}`);
        showFileOrDirExplorer(archiveFilePath);
        return archiveFilePath;
    } catch (error: any) {
        return reportArchiveFailure(
            config.exportTitle,
            'export',
            config,
            error,
        );
    } finally {
        hideProgressBar(config.exportTitle);
    }
}

function validateManifest(
    jsonData: unknown,
    config: SingleItemArchiveConfigType,
): ArchiveManifestType {
    const manifest = jsonData as
        (Partial<ArchiveManifestType> & { document?: unknown }) | null;
    // `document` was the field name before bible lists shared this format; it
    // is still read so an archive exported by that build still imports.
    const item =
        typeof manifest?.item === 'string'
            ? manifest.item
            : typeof manifest?.document === 'string'
              ? manifest.document
              : null;
    if (
        manifest === null ||
        typeof manifest !== 'object' ||
        manifest.version !== ARCHIVE_VERSION ||
        item === null
    ) {
        throw new Error(`Invalid ${config.itemLabel} archive manifest`);
    }
    // An older archive has no `itemKind`; only the document bundle existed then.
    const itemKind = manifest.itemKind ?? 'document';
    if (itemKind !== config.itemKind) {
        throw new Error(
            `This archive holds a "${itemKind}", not a ${config.itemLabel}`,
        );
    }
    const colorNotes = manifest.colorNotes;
    return {
        version: ARCHIVE_VERSION,
        itemKind,
        item,
        files: validateArchiveFileEntries(
            manifest.files,
            `Invalid ${config.itemLabel} archive file entry`,
        ),
        backgroundMetas: validateArchiveBackgroundMetas(
            manifest.backgroundMetas,
        ),
        // Every value is re-checked by `setColorNoteFilePathSettings`, so a
        // hand-edited manifest cannot push a non-color into the settings.
        colorNotes:
            colorNotes !== null && typeof colorNotes === 'object'
                ? colorNotes
                : {},
    };
}

/**
 * The item's own destination, resolved up front so a feature whose folder is
 * not a plain constant fails before anything is written, exactly like the
 * kinds `resolveKindDirPaths` handles.
 */
function toPresetDirPathByKind(config: SingleItemArchiveConfigType) {
    if (config.getItemDirSettingName === undefined) {
        return undefined;
    }
    const dirPath = DirSource.getDirPathBySettingName(
        config.getItemDirSettingName(),
    );
    if (!dirPath) {
        throw new Error(
            `No "${config.itemLabel}" folder is selected yet — open that list` +
                ' and choose its folder first',
        );
    }
    return new Map<ArchiveFileKindType, string>([[config.itemKind, dirPath]]);
}

export async function importSingleItemArchive(
    archiveFilePath: string,
    config: SingleItemArchiveConfigType,
) {
    const extractDir = await createWorkDir(`${config.workDirPrefix}-import`);
    try {
        // A protected bundle is decrypted into the same work dir this is
        // already unpacking into, so `safeDeleteDir` below carries the plain
        // copy away with everything else.
        const readableArchive = await openArchiveForReading(
            archiveFilePath,
            extractDir,
            config.importTitle,
        );
        if (readableArchive === null) {
            return null;
        }
        await tarExtract(readableArchive.filePath, extractDir);
        const manifest = validateManifest(
            await readArchiveManifest(
                extractDir,
                `Invalid ${config.itemLabel} archive manifest`,
            ),
            config,
        );
        // Every folder the import writes into is resolved before a single file
        // is copied, so a list with no folder chosen yet fails cleanly instead
        // of leaving half a bundle behind.
        const dirPathByKind = resolveKindDirPaths(
            manifest.files,
            toPresetDirPathByKind(config),
        );
        const { localFilePathByOriginalPath, writtenItemFilePaths } =
            await importArchiveFiles(extractDir, manifest.files, dirPathByKind);
        const itemFilePath = localFilePathByOriginalPath.get(manifest.item);
        if (itemFilePath === undefined) {
            throw new Error(`The archive holds no ${config.itemLabel}`);
        }
        await applyImportedCanvasMedia(
            writtenItemFilePaths,
            localFilePathByOriginalPath,
        );
        await importBackgroundMetas(
            extractDir,
            manifest.backgroundMetas,
            localFilePathByOriginalPath,
        );
        // Only onto an item this import WROTE. A reused one is the operator's
        // own file, already carrying their colors, and overwriting them is
        // exactly what an existing `.bg.json` is spared from.
        if (writtenItemFilePaths.includes(itemFilePath)) {
            setColorNoteFilePathSettings(itemFilePath, manifest.colorNotes);
        }
        FileSource.getInstance(itemFilePath).fireUpdateEvent();
        return itemFilePath;
    } finally {
        await safeDeleteDir(extractDir);
    }
}

async function runSingleItemArchiveImport(
    archiveFilePath: string,
    config: SingleItemArchiveConfigType,
) {
    showProgressBar(config.importTitle);
    try {
        const itemFilePath = await importSingleItemArchive(
            archiveFilePath,
            config,
        );
        // `null` is the password prompt being cancelled — the operator already
        // knows they backed out, so it gets no toast.
        if (itemFilePath === null) {
            return null;
        }
        showSimpleToast(
            config.importTitle,
            `Imported ${FileSource.getInstance(itemFilePath).name}`,
        );
        return itemFilePath;
    } catch (error: any) {
        return reportArchiveFailure(
            config.importTitle,
            'import',
            config,
            error,
        );
    } finally {
        hideProgressBar(config.importTitle);
    }
}

export async function selectAndImportSingleItemArchive(
    config: SingleItemArchiveConfigType,
) {
    const filePaths = await selectFiles([
        {
            name: `Open Worship ${config.fallbackName} Archive`,
            // `enc` is the password protected shape of the same bundle.
            extensions: ['gz', 'tgz', 'tar', 'enc'],
        },
    ]);
    const archiveFilePath = filePaths[0];
    if (!archiveFilePath) {
        return null;
    }
    return await runSingleItemArchiveImport(archiveFilePath, config);
}

/**
 * Ask for a URL, stream the archive into a temp work dir, then hand it to the
 * same import the file picker and drop paths use. The bundle is deleted as soon
 * as it has been unpacked — it carries every media file the item uses and can
 * be big, so keeping a second copy around is wasted disk.
 */
export async function askAndImportSingleItemArchiveFromUrl(
    config: SingleItemArchiveConfigType,
) {
    const url = await askForURL(tran('Import From URL'), config.urlLabel);
    if (url === null) {
        return null;
    }
    const workDirPath = await createWorkDir(`${config.workDirPrefix}-url`);
    try {
        const archiveFilePath = pathJoin(
            workDirPath,
            toArchiveFileNameFromUrl(
                url,
                config.dotExtension,
                config.fallbackName,
            ),
        );
        const response = await initHttpRequest(new URL(url));
        await streamDownloadFile(
            archiveFilePath,
            response,
            messageCallback,
            true,
        );
        return await runSingleItemArchiveImport(archiveFilePath, config);
    } catch (error: any) {
        return reportArchiveFailure(
            config.importTitle,
            'import',
            config,
            error,
        );
    } finally {
        await safeDeleteDir(workDirPath);
    }
}

/**
 * Import an archive dropped onto its list. The file is read from where it
 * already sits — `appFilePath` is stamped onto every `File` the electron
 * preload hands over — because a bundle can be big and copying it into the app
 * folders just to unpack it is wasted I/O. A drop that somehow carries no path
 * is staged in the temp folder instead of being refused.
 */
export async function importDroppedSingleItemArchive(
    file: DroppedFileType,
    config: SingleItemArchiveConfigType,
) {
    let tempDirPath: string | null = null;
    try {
        let archiveFilePath =
            typeof file === 'string' ? file : getAppFilePathFromFile(file);
        if (archiveFilePath === null) {
            tempDirPath = await createWorkDir(
                `${config.workDirPrefix}-dropped`,
            );
            archiveFilePath = await fsCopyFilePathToPath(
                file,
                tempDirPath,
                (file as File).name,
            );
        }
        if (archiveFilePath === null) {
            throw new Error(
                `Unable to read the dropped ${config.itemLabel} archive`,
            );
        }
        return await runSingleItemArchiveImport(archiveFilePath, config);
    } catch (error: any) {
        return reportArchiveFailure(
            config.importTitle,
            'import',
            config,
            error,
        );
    } finally {
        if (tempDirPath !== null) {
            await safeDeleteDir(tempDirPath);
        }
    }
}
