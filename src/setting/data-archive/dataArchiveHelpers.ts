import {
    createWorkDir,
    findExistingLocalFile,
    genNextArchiveFilePath,
    getImportCollisionPolicy,
    MANIFEST_FILE_NAME,
    readArchiveManifest,
    safeDeleteDir,
    toArchiveFileName,
    toExtractedArchivePath,
    writeArchiveManifest,
    ARCHIVE_VERSION,
    type ImportCollisionPolicyType,
} from '../../helper/appArchiveHelpers';
import DirSource from '../../helper/DirSource';
// From the LEAF, not through `DirSource`: this module's tests mock `DirSource`
// wholesale, and a mocked named export comes back `undefined` — which here would
// be baked silently into the exclusion regex below.
import { HISTORY_DIR_NAME_SUFFIX } from '../../editing-manager/editingHistoryPathHelpers';
import { handleError } from '../../helper/errorHelpers';
import FileSource from '../../helper/FileSource';
import {
    showFileOrDirExplorer,
    tarAppend,
    tarCreate,
    tarExtract,
} from '../../server/appHelpers';
import {
    ensureDirectory,
    fsCheckDirExist,
    fsCloneFile,
    fsList,
    getDownloadPath,
    pathJoin,
    pathSeparator,
} from '../../server/fileHelpers';
import { tran } from '../../lang/langHelpers';
import {
    dataDirectories,
    getDataDirectoryBySettingName,
    type DataDirectoryType,
} from '../directory-setting/dataDirectories';

/**
 * Export/import the app's WHOLE data set — the folders listed on the Path
 * Settings page — as one `.owadata.tar`. This is the backup/move-machines
 * counterpart of the per-item bundles: a document or playlist bundle carries
 * one thing plus what it references, this carries the folders themselves.
 *
 * **Not gzipped, and written straight from the user's folders.** The data is
 * mostly already-compressed media and can run to gigabytes, so a staging copy
 * (double the disk, double the I/O) and a compression pass are both refused.
 * `tar` is given the user's own directory as its `cwd`, which means the
 * manifest cannot be one of its entries — it is appended afterwards, and
 * appending only works on a plain tar. That is the whole reason for the format.
 */

export const DATA_ARCHIVE_DOT_EXTENSION = '.owadata.tar';

const ARCHIVE_KIND = 'app-data';
const FALLBACK_NAME = 'open-worship-data';
export const EXPORT_TITLE = 'Export Data';
export const IMPORT_TITLE = 'Import Data';

/**
 * Rebuilt on demand from the document they belong to, and together they can
 * dwarf the documents themselves, so they never enter the archive.
 * (`.histories` is the per-file undo stack — deliberately not carried across
 * machines either.)
 *
 * They are named after the document's FULL name, so they always carry its
 * extension: `<doc>.histories`, `<doc>.pdf-images` (`pdfHelpers`),
 * `<doc>.pptx-htmls` (`pptxHelpers`) and `<doc>.docx-docx-htmls`
 * (`docxHelpers`). Requiring that `.<ext>` in the pattern is what keeps a
 * folder the user happened to call `wedding-images` in the archive.
 */
// One alternation rather than three patterns: this is tested against every path
// segment of every file in the archive, which for a full data set is tens of
// thousands of paths.
const EXCLUDED_NAME_PATTERNS = [
    '\\.[^.]+(\\' + HISTORY_DIR_NAME_SUFFIX + '|-images|-htmls)$',
];

export type DataArchiveFolderType = {
    settingName: string;
    /** Path inside the archive, always `/`-separated. */
    entry: string;
};

type DataArchiveManifestType = {
    version: typeof ARCHIVE_VERSION;
    kind: typeof ARCHIVE_KIND;
    folders: DataArchiveFolderType[];
};

/** A folder offered in the export panel, with the state that explains itself. */
export type ExportableDataFolderType = {
    dataDirectory: DataDirectoryType;
    dirPath: string;
};

function toPathSegments(dirPath: string) {
    return dirPath.split(pathSeparator).filter((part) => {
        return part.length > 0;
    });
}

/**
 * The deepest folder every selected directory lives under, plus each one's path
 * relative to it. That folder becomes tar's `cwd`, which is what lets the
 * archive be written without copying anything first.
 *
 * The prefix is always cut at least one segment short of the shortest path, so
 * a single selected folder still has a name of its own inside the archive.
 */
export function toCommonAncestor(dirPaths: string[]) {
    const segmentsList = dirPaths.map(toPathSegments);
    let commonLength = Math.min(
        ...segmentsList.map((segments) => {
            return segments.length - 1;
        }),
    );
    for (let index = 0; index < commonLength; index++) {
        const segment = segmentsList[0][index].toLocaleLowerCase();
        const isSame = segmentsList.every((segments) => {
            return segments[index].toLocaleLowerCase() === segment;
        });
        if (!isSame) {
            commonLength = index;
            break;
        }
    }
    if (commonLength < 1) {
        throw new Error(
            'The selected folders have no common parent folder (are they on' +
                ' different drives?), so they cannot go in one archive',
        );
    }
    const ancestorDir = pathJoin(...segmentsList[0].slice(0, commonLength));
    const entries = segmentsList.map((segments) => {
        return segments.slice(commonLength).join('/');
    });
    return { ancestorDir, entries };
}

/**
 * The data folders that actually exist right now. A folder with no path chosen,
 * or one whose path has gone missing, has nothing to export and is left out
 * rather than failing the whole archive.
 */
export async function getExportableDataFolders() {
    const folders: ExportableDataFolderType[] = [];
    for (const dataDirectory of dataDirectories) {
        const dirPath = DirSource.getDirPathBySettingName(
            dataDirectory.settingName,
        );
        if (!dirPath || !(await fsCheckDirExist(dirPath))) {
            continue;
        }
        folders.push({ dataDirectory, dirPath });
    }
    return folders;
}

export async function createDataArchive(folders: ExportableDataFolderType[]) {
    if (folders.length === 0) {
        throw new Error('No folder to export');
    }
    const { ancestorDir, entries } = toCommonAncestor(
        folders.map((folder) => {
            return folder.dirPath;
        }),
    );
    const archiveFilePath = await genNextArchiveFilePath(
        getDownloadPath(),
        toArchiveFileName(
            FALLBACK_NAME,
            DATA_ARCHIVE_DOT_EXTENSION,
            FALLBACK_NAME,
        ),
        DATA_ARCHIVE_DOT_EXTENSION,
    );
    await tarCreate(
        ancestorDir,
        archiveFilePath,
        entries,
        false,
        EXCLUDED_NAME_PATTERNS,
    );
    const manifest: DataArchiveManifestType = {
        version: ARCHIVE_VERSION,
        kind: ARCHIVE_KIND,
        folders: folders.map((folder, index) => {
            return {
                settingName: folder.dataDirectory.settingName,
                entry: entries[index],
            };
        }),
    };
    const stagingDir = await createWorkDir('owadata-manifest');
    try {
        await writeArchiveManifest(stagingDir, manifest);
        await tarAppend(archiveFilePath, stagingDir, [MANIFEST_FILE_NAME]);
    } finally {
        await safeDeleteDir(stagingDir);
    }
    return archiveFilePath;
}

export async function exportData(folders: ExportableDataFolderType[]) {
    const archiveFilePath = await createDataArchive(folders);
    showFileOrDirExplorer(archiveFilePath);
    return archiveFilePath;
}

function checkIsSafeArchiveEntry(entry: string) {
    try {
        toExtractedArchivePath('', entry);
        return true;
    } catch {
        return false;
    }
}

function validateManifest(jsonData: unknown): DataArchiveManifestType {
    const manifest = jsonData as Partial<DataArchiveManifestType> | null;
    if (
        manifest === null ||
        typeof manifest !== 'object' ||
        manifest.version !== ARCHIVE_VERSION ||
        manifest.kind !== ARCHIVE_KIND ||
        !Array.isArray(manifest.folders)
    ) {
        throw new Error('Invalid data archive manifest');
    }
    const folders = manifest.folders.filter((folder) => {
        return (
            typeof folder?.settingName === 'string' &&
            typeof folder?.entry === 'string' &&
            // An entry is joined onto a temp path, so it must not climb out of
            // it or reach a Windows path of its own. `toExtractedArchivePath`
            // is the one guard every archive uses; it throws on a bad entry.
            checkIsSafeArchiveEntry(folder.entry) &&
            getDataDirectoryBySettingName(folder.settingName) !== null
        );
    });
    if (folders.length === 0) {
        throw new Error('The archive holds no known data folder');
    }
    return { version: ARCHIVE_VERSION, kind: ARCHIVE_KIND, folders };
}

/**
 * Read just the manifest — the archive can be gigabytes and the user has not
 * chosen anything yet, so only that one entry is unpacked.
 */
export async function readDataArchiveManifest(archiveFilePath: string) {
    const workDir = await createWorkDir('owadata-read');
    try {
        await tarExtract(archiveFilePath, workDir, [MANIFEST_FILE_NAME]);
        return validateManifest(
            await readArchiveManifest(
                workDir,
                'This file is not an Open Worship data archive (no manifest)',
            ),
        );
    } finally {
        await safeDeleteDir(workDir);
    }
}

/**
 * Copy an unpacked folder into the local one, following what that folder does
 * with a name it already holds (`getImportCollisionPolicy`): an authored file
 * always becomes a new `name (1).ext` rather than being folded into the
 * operator's, a bible list is merged into the local one, and media is left
 * alone when it is byte-identical so a repeated restore costs nothing.
 */
async function copyFilesInto(
    sourceDir: string,
    destinationDir: string,
    policy: ImportCollisionPolicyType,
    counts: { copied: number; reused: number },
) {
    await ensureDirectory(destinationDir);
    // Listed ONCE and partitioned: `fsListFiles` + `fsListDirectories` would
    // each re-read the directory and re-stat every entry, doubling the syscalls
    // on a folder that can hold thousands of files.
    const entries = await fsList(sourceDir);
    for (const entry of entries) {
        if (!entry.isFile) {
            continue;
        }
        const sourceFilePath = pathJoin(sourceDir, entry.name);
        const destinationFilePath = pathJoin(destinationDir, entry.name);
        // Any hashing this needs is only paid when a name actually collides,
        // and size is compared first, so a big video is neither re-read nor
        // held in memory.
        const existingFilePath = await findExistingLocalFile(
            policy,
            sourceFilePath,
            destinationFilePath,
        );
        if (existingFilePath !== null) {
            counts.reused += 1;
            continue;
        }
        const nextFilePath =
            await FileSource.getInstance(destinationFilePath).genNextFilePath();
        await fsCloneFile(sourceFilePath, nextFilePath);
        counts.copied += 1;
    }
    for (const entry of entries) {
        // Dot-prefixed folders are skipped exactly as `fsListDirectories` does.
        if (!entry.isDirectory || entry.name.startsWith('.')) {
            continue;
        }
        await copyFilesInto(
            pathJoin(sourceDir, entry.name),
            pathJoin(destinationDir, entry.name),
            policy,
            counts,
        );
    }
}

/**
 * Restore the chosen folders. Every destination is resolved BEFORE anything is
 * unpacked — a folder with no path chosen yet would otherwise be discovered
 * halfway through, leaving a half-restored data set.
 */
export async function importDataArchive(
    archiveFilePath: string,
    folders: DataArchiveFolderType[],
) {
    if (folders.length === 0) {
        throw new Error('No folder to import');
    }
    // A folder this build does not know about is skipped rather than trusted:
    // `settingName` decides where files are written, so an archive from a newer
    // build must not be able to name a destination that is not on the list.
    const destinations = folders
        .map((folder) => {
            const dataDirectory = getDataDirectoryBySettingName(
                folder.settingName,
            );
            if (dataDirectory === null) {
                return null;
            }
            const dirPath = DirSource.getDirPathBySettingName(
                folder.settingName,
            );
            return { folder, dataDirectory, dirPath };
        })
        .filter((destination) => {
            return destination !== null;
        });
    if (destinations.length === 0) {
        throw new Error('No known data folder to import');
    }
    const missingTitles = destinations
        .filter(({ dirPath }) => {
            return !dirPath;
        })
        .map(({ dataDirectory }) => {
            return tran(dataDirectory.title);
        });
    if (missingTitles.length > 0) {
        throw new Error(
            `No folder is selected yet for: ${missingTitles.join(', ')} —` +
                ' set it in Settings → Path Settings first',
        );
    }
    const extractDir = await createWorkDir('owadata-import');
    const counts = { copied: 0, reused: 0 };
    try {
        await tarExtract(
            archiveFilePath,
            extractDir,
            destinations.map(({ folder }) => {
                return folder.entry;
            }),
        );
        for (const { folder, dirPath } of destinations) {
            const sourceDir = toExtractedArchivePath(extractDir, folder.entry);
            if (!(await fsCheckDirExist(sourceDir))) {
                continue;
            }
            await copyFilesInto(
                sourceDir,
                dirPath as string,
                getImportCollisionPolicy(folder.settingName),
                counts,
            );
        }
    } finally {
        await safeDeleteDir(extractDir);
    }
    return counts;
}

export function reportDataArchiveError(title: string, error: any) {
    handleError(error);
    return error?.message ?? `Unable to ${title.toLocaleLowerCase()}`;
}
