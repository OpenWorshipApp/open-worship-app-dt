import Bible from '../bible-list/Bible';
import BibleItem from '../bible-list/BibleItem';
import { dirSourceSettingNames } from '../helper/constants';
import DirSource from '../helper/DirSource';
import { DragTypeEnum } from '../helper/DragInf';
import { handleError } from '../helper/errorHelpers';
import FileSource from '../helper/FileSource';
import { parseJsonSafely } from '../helper/helpers';
import {
    showFileOrDirExplorer,
    tarCreate,
    tarExtract,
} from '../server/appHelpers';
import {
    fsCreateFile,
    fsCopyFilePathToPath,
    fsReadFile,
    getDownloadPath,
    pathBasename,
    pathJoin,
    selectFiles,
} from '../server/fileHelpers';
import { getAppFilePathFromFile } from '../helper/localFileHelpers';
import { initHttpRequest } from '../helper/bible-helpers/downloadHelpers';
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
import { showSimpleToast } from '../toast/toastHelpers';
import type { PlaylistType } from './Playlist';
import Playlist from './Playlist';
import type { PlaylistItemType } from './PlaylistItem';
import { slideDragTypeList } from './PlaylistItem';
import type {
    ArchiveBackgroundMetaType,
    ArchiveFileEntryType,
    ArchiveFileKindType,
} from '../helper/appArchiveHelpers';
import {
    ARCHIVE_VERSION,
    ArchiveFileCollector,
    applyImportedCanvasMedia,
    backgroundTypeKindMap,
    checkIsArchiveFileFullName,
    createWorkDir,
    genNextArchiveFilePath,
    importArchiveFiles,
    importBackgroundMetas,
    readArchiveManifest,
    resolveKindDirPaths,
    safeDeleteDir,
    stageArchiveFiles,
    toArchiveBaseName,
    toArchiveFileName,
    toArchiveFileNameFromUrl,
    toExtractedArchivePath,
    validateArchiveBackgroundMetas,
    validateArchiveFileEntries,
    writeArchiveManifest,
} from '../helper/appArchiveHelpers';

export const PLAYLIST_ARCHIVE_DOT_EXTENSION = '.owapl.tar.gz';

const PLAYLIST_FILE_NAME = 'playlist.json';
const FALLBACK_NAME = 'Playlist';

type ArchiveManifestType = {
    version: typeof ARCHIVE_VERSION;
    playlist: string;
    files: ArchiveFileEntryType[];
    backgroundMetas: ArchiveBackgroundMetaType[];
};

/**
 * A file path held by an item, described once so collecting (export) and
 * rewriting (import) cannot drift apart.
 */
type PathRefType = {
    kind: ArchiveFileKindType;
    get: () => string | null;
    set: (newFilePath: string) => void;
};

function toStringOrNull(value: unknown) {
    return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * Every json a playlist entry OWNS — which is the entry, and only the entry.
 *
 * A CC element used to be a COPY of a payload and had to be walked too, or its
 * media would import still pointing at the exporting machine's disk. It is a
 * reference now (a uuid naming a line of this same sheet), so there is nothing
 * under an entry that holds a path: the element a CC follows is itself a listed
 * entry, walked here in its own right.
 *
 * Kept as a generator over the very objects rather than a collected copy — the
 * import rewrites the paths it is handed IN PLACE — so a later kind of nested
 * json has somewhere to be added back.
 */
function* iteratePlaylistItemJsons(
    item: PlaylistItemType,
): Generator<PlaylistItemType> {
    yield item;
}

function toItemPathRefs(item: PlaylistItemType): PathRefType[] {
    const { type } = item;
    if (
        slideDragTypeList.includes(type as DragTypeEnum) ||
        type === DragTypeEnum.APP_DOCUMENT
    ) {
        const refs: PathRefType[] = [
            {
                kind: 'document',
                get: () => toStringOrNull(item.filePath),
                set: (newFilePath) => {
                    item.filePath = newFilePath;
                },
            },
        ];
        if (type === DragTypeEnum.APP_DOCUMENT) {
            // A document entry keeps the path in `data` too — that is what the
            // drag payload carried.
            refs.push({
                kind: 'document',
                get: () => toStringOrNull(item.data),
                set: (newFilePath) => {
                    item.data = newFilePath;
                },
            });
        }
        return refs;
    }
    const mediaKind = backgroundTypeKindMap[type];
    if (mediaKind !== undefined) {
        // A web background can also be a plain URL, which is self-describing
        // and has no file to bundle.
        return [
            {
                kind: mediaKind,
                get: () => toStringOrNull(item.data),
                set: (newFilePath) => {
                    item.data = newFilePath;
                },
            },
        ];
    }
    if (type === DragTypeEnum.FOREGROUND && item.data?.target === 'web') {
        return [
            {
                kind: 'web',
                get: () => toStringOrNull(item.data?.data?.filePath),
                set: (newFilePath) => {
                    item.data.data.filePath = newFilePath;
                },
            },
        ];
    }
    return [];
}

export function toPlaylistArchiveFileName(name: string) {
    return toArchiveFileName(
        name,
        PLAYLIST_ARCHIVE_DOT_EXTENSION,
        FALLBACK_NAME,
    );
}

async function collectArchiveFiles(items: PlaylistItemType[]) {
    const collector = new ArchiveFileCollector();
    for (const item of items) {
        for (const itemJson of iteratePlaylistItemJsons(item)) {
            for (const pathRef of toItemPathRefs(itemJson)) {
                const originalPath = pathRef.get();
                if (pathRef.kind === 'document') {
                    await collector.addDocument(originalPath);
                    continue;
                }
                await collector.addFile(originalPath, pathRef.kind);
            }
        }
    }
    return collector;
}

async function writeArchiveFiles(jsonData: PlaylistType, stagingDir: string) {
    await fsCreateFile(
        pathJoin(stagingDir, PLAYLIST_FILE_NAME),
        JSON.stringify(jsonData, null, 2),
        true,
    );
    const collector = await collectArchiveFiles(jsonData.items);
    const { archiveFiles, archiveEntries } = await stageArchiveFiles(
        collector,
        stagingDir,
        [PLAYLIST_FILE_NAME],
    );
    const manifest: ArchiveManifestType = {
        version: ARCHIVE_VERSION,
        playlist: PLAYLIST_FILE_NAME,
        files: archiveFiles,
        backgroundMetas: collector.backgroundMetas,
    };
    await writeArchiveManifest(stagingDir, manifest);
    return archiveEntries;
}

export async function createPlaylistArchive(playlist: Playlist) {
    const jsonData = await playlist.getJsonData();
    if (jsonData === null) {
        throw new Error('Unable to read the playlist');
    }
    const stagingDir = await createWorkDir('owapl-export');
    try {
        const archiveEntries = await writeArchiveFiles(jsonData, stagingDir);
        const archiveFilePath = await genNextArchiveFilePath(
            getDownloadPath(),
            toPlaylistArchiveFileName(playlist.fileSource.name),
            PLAYLIST_ARCHIVE_DOT_EXTENSION,
        );
        await tarCreate(stagingDir, archiveFilePath, archiveEntries, true);
        return archiveFilePath;
    } finally {
        await safeDeleteDir(stagingDir);
    }
}

export async function exportPlaylist(playlist: Playlist) {
    try {
        const archiveFilePath = await createPlaylistArchive(playlist);
        showSimpleToast('Export Playlist', `Exported to ${archiveFilePath}`);
        showFileOrDirExplorer(archiveFilePath);
        return archiveFilePath;
    } catch (error: any) {
        handleError(error);
        showSimpleToast(
            'Export Playlist',
            error?.message ?? 'Unable to export the playlist',
        );
        return null;
    }
}

function validateManifest(jsonData: unknown): ArchiveManifestType {
    const manifest = jsonData as Partial<ArchiveManifestType> | null;
    if (
        manifest === null ||
        typeof manifest !== 'object' ||
        manifest.version !== ARCHIVE_VERSION ||
        typeof manifest.playlist !== 'string'
    ) {
        throw new Error('Invalid playlist archive manifest');
    }
    return {
        version: ARCHIVE_VERSION,
        playlist: manifest.playlist,
        files: validateArchiveFileEntries(
            manifest.files,
            'Invalid playlist archive file entry',
        ),
        backgroundMetas: validateArchiveBackgroundMetas(
            manifest.backgroundMetas,
        ),
    };
}

/**
 * A bible verse carries no file, so it is re-created in the Default bible list
 * and the entry is re-pointed at it. An identical verse already in Default is
 * reused instead of being added twice.
 */
async function importBibleItem(item: PlaylistItemType) {
    const bibleItem = BibleItem.dragDeserialize(item.data);
    if (bibleItem === null) {
        return;
    }
    const defaultBible = await Bible.getDefault();
    if (defaultBible === null) {
        throw new Error('Unable to open the Default bible list');
    }
    const existingBibleItem = defaultBible.items.find((existing) => {
        return (
            existing.bibleKey === bibleItem.bibleKey &&
            JSON.stringify(existing.toJson().target) ===
                JSON.stringify(bibleItem.toJson().target)
        );
    });
    let itemId: number;
    if (existingBibleItem !== undefined) {
        itemId = existingBibleItem.id;
    } else {
        defaultBible.addBibleItem(bibleItem);
        if (!(await defaultBible.save())) {
            throw new Error('Unable to save into the Default bible list');
        }
        itemId = defaultBible.maxItemId;
    }
    item.data = {
        ...item.data,
        id: itemId,
        filePath: defaultBible.filePath,
    };
}

async function applyImportedPaths(
    items: PlaylistItemType[],
    localFilePathByOriginalPath: Map<string, string>,
) {
    for (const item of items) {
        // A CC bible verse is re-created in the Default bible list exactly as a
        // listed one is — inside this loop, not beside it: imported without it
        // the CC would point at a bible file that does not exist here.
        for (const itemJson of iteratePlaylistItemJsons(item)) {
            for (const pathRef of toItemPathRefs(itemJson)) {
                const originalPath = pathRef.get();
                if (originalPath === null) {
                    continue;
                }
                const localFilePath =
                    localFilePathByOriginalPath.get(originalPath);
                if (localFilePath !== undefined) {
                    pathRef.set(localFilePath);
                }
            }
            if (itemJson.type === DragTypeEnum.BIBLE_ITEM) {
                await importBibleItem(itemJson);
            }
        }
    }
}

export async function importPlaylistArchive(archiveFilePath: string) {
    const extractDir = await createWorkDir('owapl-import');
    try {
        await tarExtract(archiveFilePath, extractDir);
        const manifest = validateManifest(
            await readArchiveManifest(
                extractDir,
                'Invalid playlist archive manifest',
            ),
        );
        const jsonData = parseJsonSafely(
            await fsReadFile(
                toExtractedArchivePath(extractDir, manifest.playlist),
            ),
            true,
        ) as PlaylistType | null;
        if (jsonData === null || !Array.isArray(jsonData.items)) {
            throw new Error('Invalid playlist data in the archive');
        }
        // Every folder the import needs is resolved up front — the playlists
        // folder included — so a missing one fails before anything has been
        // written rather than after half the bundle has landed.
        const playlistDirPath = DirSource.getDirPathBySettingName(
            dirSourceSettingNames.PLAYLIST,
        );
        if (!playlistDirPath) {
            throw new Error('No playlists folder is selected yet');
        }
        const dirPathByKind = resolveKindDirPaths(manifest.files);
        const { localFilePathByOriginalPath, writtenItemFilePaths } =
            await importArchiveFiles(extractDir, manifest.files, dirPathByKind);
        await applyImportedPaths(jsonData.items, localFilePathByOriginalPath);
        await applyImportedCanvasMedia(
            writtenItemFilePaths,
            localFilePathByOriginalPath,
        );
        await importBackgroundMetas(
            extractDir,
            manifest.backgroundMetas,
            localFilePathByOriginalPath,
        );
        const archiveFileName = toArchiveBaseName(
            pathBasename(archiveFilePath),
            PLAYLIST_ARCHIVE_DOT_EXTENSION,
        );
        const fileSource = FileSource.getInstance(
            pathJoin(playlistDirPath, `${archiveFileName}.owp`),
        );
        const playlistFilePath = await fileSource.genNextFilePath();
        await fsCreateFile(playlistFilePath, JSON.stringify(jsonData), true);
        FileSource.getInstance(playlistFilePath).fireUpdateEvent();
        return Playlist.getInstance(playlistFilePath);
    } finally {
        await safeDeleteDir(extractDir);
    }
}

const IMPORT_TITLE = 'Import Playlist';

async function runPlaylistArchiveImport(archiveFilePath: string) {
    showProgressBar(IMPORT_TITLE);
    try {
        const playlist = await importPlaylistArchive(archiveFilePath);
        showSimpleToast(IMPORT_TITLE, `Imported ${playlist.fileSource.name}`);
        return playlist;
    } catch (error: any) {
        handleError(error);
        showSimpleToast(
            IMPORT_TITLE,
            error?.message ?? 'Unable to import the playlist',
        );
        return null;
    } finally {
        hideProgressBar(IMPORT_TITLE);
    }
}

export async function selectAndImportPlaylistArchive() {
    const filePaths = await selectFiles([
        {
            name: 'Open Worship Playlist Archive',
            extensions: ['gz', 'tgz', 'tar'],
        },
    ]);
    const archiveFilePath = filePaths[0];
    if (!archiveFilePath) {
        return null;
    }
    return await runPlaylistArchiveImport(archiveFilePath);
}

export function checkIsPlaylistArchiveFileFullName(fileFullName: string) {
    return checkIsArchiveFileFullName(
        fileFullName,
        PLAYLIST_ARCHIVE_DOT_EXTENSION,
    );
}

/**
 * Ask for a URL, stream the archive into a temp work dir, then hand it to the
 * same import the file picker and drop paths use. The bundle is deleted as soon
 * as it has been unpacked — it carries every media file the playlist uses and
 * can be big, so keeping a second copy around is wasted disk.
 *
 * The imported playlist is named after the archive file (see
 * `importPlaylistArchive`), so the downloaded copy must keep the name the URL
 * carries — a random temp name would produce a playlist called after a UUID.
 */
export async function askAndImportPlaylistArchiveFromUrl() {
    const url = await askForURL(
        tran('Import From URL'),
        'Playlist Archive URL:',
    );
    if (url === null) {
        return null;
    }
    const workDirPath = await createWorkDir('owapl-url');
    try {
        const archiveFilePath = pathJoin(
            workDirPath,
            toArchiveFileNameFromUrl(
                url,
                PLAYLIST_ARCHIVE_DOT_EXTENSION,
                FALLBACK_NAME,
            ),
        );
        const response = await initHttpRequest(new URL(url));
        await streamDownloadFile(
            archiveFilePath,
            response,
            messageCallback,
            true,
        );
        return await runPlaylistArchiveImport(archiveFilePath);
    } catch (error: any) {
        handleError(error);
        showSimpleToast(
            IMPORT_TITLE,
            error?.message ?? 'Unable to import the playlist',
        );
        return null;
    } finally {
        await safeDeleteDir(workDirPath);
    }
}

/**
 * Import an archive dropped onto the playlists list. The file is read from
 * where it already sits — a bundle carries every media file the playlist uses
 * and can be big, so copying it into the app folders just to unpack it is
 * wasted I/O. `appFilePath` is stamped onto every `File` the electron preload
 * hands over; a drop that somehow carries none is staged in the temp folder
 * instead of being refused.
 */
export async function importDroppedPlaylistArchive(file: DroppedFileType) {
    let tempDirPath: string | null = null;
    try {
        let archiveFilePath =
            typeof file === 'string' ? file : getAppFilePathFromFile(file);
        if (archiveFilePath === null) {
            tempDirPath = await createWorkDir('owapl-dropped');
            archiveFilePath = await fsCopyFilePathToPath(
                file,
                tempDirPath,
                (file as File).name,
            );
        }
        if (archiveFilePath === null) {
            throw new Error('Unable to read the dropped playlist archive');
        }
        return await runPlaylistArchiveImport(archiveFilePath);
    } catch (error: any) {
        handleError(error);
        showSimpleToast(
            IMPORT_TITLE,
            error?.message ?? 'Unable to import the playlist',
        );
        return null;
    } finally {
        if (tempDirPath !== null) {
            await safeDeleteDir(tempDirPath);
        }
    }
}
