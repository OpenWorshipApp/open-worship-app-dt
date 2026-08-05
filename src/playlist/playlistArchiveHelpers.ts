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
    ensureDirectory,
    fsCheckFileExist,
    fsCloneFile,
    fsCopyFilePathToPath,
    fsCreateFile,
    fsDeleteDir,
    fsReadFile,
    getDownloadPath,
    getFileMD5,
    getTempPath,
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
import { BaseDirFileSource } from '../setting/directory-setting/directoryHelpers';
import { showSimpleToast } from '../toast/toastHelpers';
import type { PlaylistType } from './Playlist';
import Playlist from './Playlist';
import type { PlaylistItemType } from './PlaylistItem';
import { slideDragTypeList } from './PlaylistItem';

export const PLAYLIST_ARCHIVE_DOT_EXTENSION = '.owapl.tar.gz';

const MANIFEST_FILE_NAME = 'manifest.json';
const PLAYLIST_FILE_NAME = 'playlist.json';
const ARCHIVE_FILES_DIR = 'files';
const ARCHIVE_VERSION = 1;
const BACKGROUND_META_DOT_EXTENSION = '.bg.json';
// The document kinds whose JSON holds canvas items (see
// `src/server/mime/app-document-types.json`). Lyric, PDF, PPTX and DOCX
// documents have no canvas, so there is nothing inside them to bundle.
const CANVAS_DOCUMENT_DOT_EXTENSIONS = ['.ows', '.preview'];
const INVALID_FILE_NAME_CHAR_CODES = new Set([
    34, 42, 47, 58, 60, 62, 63, 92, 124,
]);

/**
 * Which directory an archived file belongs in once imported. A slide entry
 * bundles the WHOLE document it came from, so importing one re-creates the
 * original app document and the slide reference resolves against it.
 */
type ArchiveFileKindType = 'document' | 'image' | 'video' | 'audio' | 'web';

const kindDirSettingNameMap: Record<ArchiveFileKindType, string> = {
    document: dirSourceSettingNames.APP_DOCUMENT,
    image: dirSourceSettingNames.BACKGROUND_IMAGE,
    video: dirSourceSettingNames.BACKGROUND_VIDEO,
    audio: dirSourceSettingNames.BACKGROUND_AUDIO,
    web: dirSourceSettingNames.BACKGROUND_WEB,
};

type ArchiveFileEntryType = {
    originalPath: string;
    archivePath: string;
    kind: ArchiveFileKindType;
};

/**
 * A document's `.bg.json` sidecar, carried alongside the document so an
 * imported document keeps the backgrounds attached to it. The media the sidecar
 * points at rides in `files` like any other, and the archived copy holds
 * absolute original paths so import can map them.
 */
type ArchiveBackgroundMetaType = {
    documentOriginalPath: string;
    archivePath: string;
};

type ArchiveManifestType = {
    version: typeof ARCHIVE_VERSION;
    playlist: string;
    files: ArchiveFileEntryType[];
    backgroundMetas: ArchiveBackgroundMetaType[];
};

/**
 * Which folder a media entry belongs in, by drag type. Used for both halves of
 * the job — a playlist entry's own payload and the entries inside a document's
 * background sidecar — so the two can never disagree about where a file goes.
 * (A sidecar never holds audio; listing it costs nothing and keeps one map.)
 */
const backgroundTypeKindMap: { [key: string]: ArchiveFileKindType } = {
    [DragTypeEnum.BACKGROUND_IMAGE]: 'image',
    [DragTypeEnum.BACKGROUND_VIDEO]: 'video',
    [DragTypeEnum.BACKGROUND_AUDIO]: 'audio',
    [DragTypeEnum.BACKGROUND_WEB]: 'web',
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

function sanitizeFileNamePart(value: string) {
    const sanitizedText = Array.from(value.trim())
        .map((char) => {
            const codePoint = char.codePointAt(0) ?? 0;
            if (codePoint < 32 || INVALID_FILE_NAME_CHAR_CODES.has(codePoint)) {
                return '_';
            }
            return char;
        })
        .join('');
    return sanitizedText
        .replace(/_+/g, '_')
        .replace(/\s+/g, ' ')
        .replace(/[_ .]+$/g, '');
}

export function toPlaylistArchiveFileName(name: string) {
    const fileName = sanitizeFileNamePart(name).slice(0, 120);
    return `${fileName || 'Playlist'}${PLAYLIST_ARCHIVE_DOT_EXTENSION}`;
}

function createWorkDirName(prefix: string) {
    const randomId =
        globalThis.crypto?.randomUUID?.() ??
        `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return `${prefix}-${randomId}`;
}

async function createWorkDir(prefix: string, baseDir = getTempPath()) {
    const workDir = pathJoin(baseDir, createWorkDirName(prefix));
    await ensureDirectory(workDir);
    return workDir;
}

async function safeDeleteDir(dirPath: string) {
    try {
        await fsDeleteDir(dirPath);
    } catch (error) {
        handleError(error);
    }
}

function toArchiveFileName(index: number, filePath: string) {
    const fileName = sanitizeFileNamePart(pathBasename(filePath));
    return `${String(index + 1).padStart(3, '0')}-${fileName || 'file'}`;
}

function checkIsCanvasDocumentPath(filePath: string) {
    const lowerCasedPath = filePath.toLocaleLowerCase();
    return CANVAS_DOCUMENT_DOT_EXTENSIONS.some((dotExtension) => {
        return lowerCasedPath.endsWith(dotExtension);
    });
}

/**
 * The canvas boxes inside a document that point at a file on disk. An IMAGE box
 * inlines its pixels as base64 and so travels inside the document itself, but a
 * VIDEO box only stores `filePath` (inlining a video would balloon the
 * document) — so those files have to be bundled separately, or the slide
 * arrives on the other machine with a dead video box.
 *
 * The document JSON is walked rather than loaded through `AppDocument`: reading
 * a path list must not pay for building the whole model, and importing
 * `appDocumentHelpers` from here closes a module cycle.
 */
function* iterateCanvasFileItems(jsonData: unknown) {
    const items = (jsonData as { items?: unknown } | null)?.items;
    if (!Array.isArray(items)) {
        return;
    }
    for (const item of items) {
        const canvasItems = item?.canvasItems;
        if (!Array.isArray(canvasItems)) {
            continue;
        }
        for (const canvasItem of canvasItems) {
            if (
                canvasItem?.type === 'video' &&
                typeof canvasItem.filePath === 'string' &&
                canvasItem.filePath.length > 0
            ) {
                yield canvasItem as { filePath: string };
            }
        }
    }
}

async function readCanvasDocumentJson(filePath: string) {
    if (!checkIsCanvasDocumentPath(filePath)) {
        return null;
    }
    try {
        return parseJsonSafely(await fsReadFile(filePath), true);
    } catch (error) {
        // A document that cannot be read is not worth failing the whole export
        // or import over — it is already being copied verbatim either way.
        handleError(error);
        return null;
    }
}

class ArchiveFileCollector {
    readonly entryByOriginalPath = new Map<string, ArchiveFileEntryType>();
    readonly backgroundMetas: ArchiveBackgroundMetaType[] = [];
    // Sidecars are rewritten before archiving, so they are staged as content
    // rather than copied from disk.
    readonly extraContentByArchivePath = new Map<string, string>();
    // A document reached both as a slide entry and as a document entry must not
    // archive its sidecar twice.
    private readonly seenBackgroundMetaPaths = new Set<string>();
    private readonly seenCanvasDocumentPaths = new Set<string>();

    private nextArchivePath(originalPath: string) {
        const index =
            this.entryByOriginalPath.size + this.extraContentByArchivePath.size;
        return `${ARCHIVE_FILES_DIR}/${toArchiveFileName(index, originalPath)}`;
    }

    async addFile(originalPath: string | null, kind: ArchiveFileKindType) {
        if (originalPath === null) {
            return false;
        }
        if (this.entryByOriginalPath.has(originalPath)) {
            return true;
        }
        if (!(await fsCheckFileExist(originalPath))) {
            return false;
        }
        this.entryByOriginalPath.set(originalPath, {
            originalPath,
            archivePath: this.nextArchivePath(originalPath),
            kind,
        });
        return true;
    }

    /**
     * Pull in a document's attached backgrounds: the media itself plus a copy
     * of the sidecar whose entries have been resolved to absolute paths, which
     * is what import maps back to the local copies.
     */
    async addBackgroundMeta(documentOriginalPath: string) {
        if (this.seenBackgroundMetaPaths.has(documentOriginalPath)) {
            return;
        }
        this.seenBackgroundMetaPaths.add(documentOriginalPath);
        const metaFilePath = `${documentOriginalPath}${BACKGROUND_META_DOT_EXTENSION}`;
        if (!(await fsCheckFileExist(metaFilePath))) {
            return;
        }
        const metaData = parseJsonSafely(
            await fsReadFile(metaFilePath),
            true,
        ) as {
            [key: string]: { type: string; item: unknown };
        } | null;
        if (
            metaData === null ||
            typeof metaData !== 'object' ||
            Object.keys(metaData).length === 0
        ) {
            return;
        }
        for (const value of Object.values(metaData)) {
            const kind = backgroundTypeKindMap[value?.type];
            if (kind === undefined || typeof value.item !== 'string') {
                continue;
            }
            const resolvedFilePath = new BaseDirFileSource(
                kindDirSettingNameMap[kind],
                value.item,
            ).fileSource?.filePath;
            if (
                resolvedFilePath === undefined ||
                resolvedFilePath === null ||
                !(await this.addFile(resolvedFilePath, kind))
            ) {
                continue;
            }
            value.item = resolvedFilePath;
        }
        const archivePath = this.nextArchivePath(metaFilePath);
        this.extraContentByArchivePath.set(
            archivePath,
            JSON.stringify(metaData),
        );
        this.backgroundMetas.push({ documentOriginalPath, archivePath });
    }

    /**
     * Pull in the media a document's own canvas points at. The files ride in
     * `manifest.files` like any other, keyed by the absolute path the document
     * holds — which is exactly what import looks the local copy up by, so no
     * extra manifest section is needed and older archives stay readable.
     */
    async addCanvasDocumentMedia(documentOriginalPath: string) {
        if (this.seenCanvasDocumentPaths.has(documentOriginalPath)) {
            return;
        }
        this.seenCanvasDocumentPaths.add(documentOriginalPath);
        const jsonData = await readCanvasDocumentJson(documentOriginalPath);
        if (jsonData === null) {
            return;
        }
        for (const canvasItem of iterateCanvasFileItems(jsonData)) {
            await this.addFile(canvasItem.filePath, 'video');
        }
    }
}

async function collectArchiveFiles(items: PlaylistItemType[]) {
    const collector = new ArchiveFileCollector();
    for (const item of items) {
        for (const pathRef of toItemPathRefs(item)) {
            const originalPath = pathRef.get();
            const isAdded = await collector.addFile(originalPath, pathRef.kind);
            if (isAdded && pathRef.kind === 'document') {
                await collector.addBackgroundMeta(originalPath as string);
                await collector.addCanvasDocumentMedia(originalPath as string);
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
    const archiveFiles = Array.from(collector.entryByOriginalPath.values());
    const hasFiles =
        archiveFiles.length > 0 || collector.extraContentByArchivePath.size > 0;
    if (hasFiles) {
        await ensureDirectory(pathJoin(stagingDir, ARCHIVE_FILES_DIR));
        for (const archiveFile of archiveFiles) {
            await fsCloneFile(
                archiveFile.originalPath,
                pathJoin(stagingDir, ...archiveFile.archivePath.split('/')),
            );
        }
        for (const [
            archivePath,
            content,
        ] of collector.extraContentByArchivePath) {
            await fsCreateFile(
                pathJoin(stagingDir, ...archivePath.split('/')),
                content,
                true,
            );
        }
    }
    const manifest: ArchiveManifestType = {
        version: ARCHIVE_VERSION,
        playlist: PLAYLIST_FILE_NAME,
        files: archiveFiles,
        backgroundMetas: collector.backgroundMetas,
    };
    await fsCreateFile(
        pathJoin(stagingDir, MANIFEST_FILE_NAME),
        JSON.stringify(manifest, null, 2),
        true,
    );
    return [
        MANIFEST_FILE_NAME,
        PLAYLIST_FILE_NAME,
        ...(hasFiles ? [ARCHIVE_FILES_DIR] : []),
    ];
}

export async function createPlaylistArchive(playlist: Playlist) {
    const jsonData = await playlist.getJsonData();
    if (jsonData === null) {
        throw new Error('Unable to read the playlist');
    }
    const stagingDir = await createWorkDir('owapl-export');
    try {
        const archiveEntries = await writeArchiveFiles(jsonData, stagingDir);
        const archiveFilePath = await FileSource.getInstance(
            pathJoin(
                getDownloadPath(),
                toPlaylistArchiveFileName(playlist.fileSource.name),
            ),
        ).genNextFilePath();
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
        typeof manifest.playlist !== 'string' ||
        !Array.isArray(manifest.files)
    ) {
        throw new Error('Invalid playlist archive manifest');
    }
    const files = manifest.files.map((file) => {
        if (
            typeof file?.originalPath !== 'string' ||
            typeof file?.archivePath !== 'string' ||
            !(file?.kind in kindDirSettingNameMap)
        ) {
            throw new TypeError('Invalid playlist archive file entry');
        }
        return {
            originalPath: file.originalPath,
            archivePath: file.archivePath,
            kind: file.kind,
        };
    });
    const backgroundMetas = (manifest.backgroundMetas ?? []).filter(
        (backgroundMeta) => {
            return (
                typeof backgroundMeta?.documentOriginalPath === 'string' &&
                typeof backgroundMeta?.archivePath === 'string'
            );
        },
    );
    return {
        version: ARCHIVE_VERSION,
        playlist: manifest.playlist,
        files,
        backgroundMetas,
    };
}

function toExtractedArchivePath(extractDir: string, archivePath: string) {
    const parts = archivePath.split('/').filter((part) => part.length > 0);
    if (
        parts.length === 0 ||
        parts.some((part) => part === '..' || part.includes('\\'))
    ) {
        throw new Error('Invalid playlist archive file path');
    }
    return pathJoin(extractDir, ...parts);
}

function getKindDirPath(kind: ArchiveFileKindType) {
    const dirPath = DirSource.getDirPathBySettingName(
        kindDirSettingNameMap[kind],
    );
    if (!dirPath) {
        throw new Error(
            `No "${kind}" folder is selected yet — open that list and choose` +
                ' its folder first',
        );
    }
    return dirPath;
}

/**
 * Resolve every folder the import will write into, BEFORE a single file is
 * copied. `getKindDirPath` throws when a list has no folder chosen yet, and
 * discovering that halfway through leaves the user with some of the bundle
 * imported and no playlist to show for it.
 */
function resolveKindDirPaths(files: ArchiveFileEntryType[]) {
    const dirPathByKind = new Map<ArchiveFileKindType, string>();
    for (const file of files) {
        if (!dirPathByKind.has(file.kind)) {
            dirPathByKind.set(file.kind, getKindDirPath(file.kind));
        }
    }
    return dirPathByKind;
}

/**
 * The local file an archived one should be treated AS, or null when it has to
 * be written fresh. Same name is NOT the same file: two machines can each hold
 * an `a.mp4` that is a different video, and silently reusing the local one
 * would quietly project the wrong clip. The CONTENTS decide — an identical MD5
 * means reuse (so importing the same bundle twice still adds nothing), and
 * anything else falls through to a copy, which `fsCopyFilePathToPath` lands
 * beside it as `a (1).mp4` via `genNextFilePath`.
 *
 * MD5 is read as a stream (`getFileChecksum`), so a big video is never held in
 * memory, and the hash is only paid when a name actually collides.
 */
async function findReusableLocalFile(
    extractedFilePath: string,
    destinationFilePath: string,
) {
    if (!(await fsCheckFileExist(destinationFilePath))) {
        return null;
    }
    const [existingMd5, archivedMd5] = await Promise.all([
        getFileMD5(destinationFilePath),
        getFileMD5(extractedFilePath),
    ]);
    // An unreadable file on either side leaves the answer unknown. Reading that
    // as "same" could hide the wrong video behind the right name, so the safe
    // reading is "different": the operator ends up with one extra copy rather
    // than a service that projects the wrong thing.
    if (existingMd5 === null || existingMd5 !== archivedMd5) {
        return null;
    }
    return destinationFilePath;
}

/**
 * Re-create the native files the playlist points at. A file already there with
 * the SAME CONTENTS is reused rather than duplicated, so importing the same
 * bundle twice does not fill the folders with copies; a name clash over
 * different contents lands beside it under the next free name.
 */
async function importArchiveFiles(
    extractDir: string,
    files: ArchiveFileEntryType[],
    dirPathByKind: Map<ArchiveFileKindType, string>,
) {
    const localFilePathByOriginalPath = new Map<string, string>();
    // Only the documents this import actually WROTE may be rewritten
    // afterwards; a reused one is the operator's own file and is left alone,
    // exactly as an existing `.bg.json` sidecar is.
    const writtenDocumentFilePaths: string[] = [];
    for (const file of files) {
        const extractedFilePath = toExtractedArchivePath(
            extractDir,
            file.archivePath,
        );
        if (!(await fsCheckFileExist(extractedFilePath))) {
            throw new Error(`Archive file not found: ${file.archivePath}`);
        }
        const dirPath = dirPathByKind.get(file.kind) as string;
        const fileFullName = FileSource.getInstance(file.originalPath).fullName;
        const reusableFilePath = await findReusableLocalFile(
            extractedFilePath,
            pathJoin(dirPath, fileFullName),
        );
        if (reusableFilePath !== null) {
            localFilePathByOriginalPath.set(
                file.originalPath,
                reusableFilePath,
            );
            continue;
        }
        const importedFilePath = await fsCopyFilePathToPath(
            extractedFilePath,
            dirPath,
            fileFullName,
        );
        if (importedFilePath === null) {
            throw new Error(`Unable to import file: ${file.archivePath}`);
        }
        localFilePathByOriginalPath.set(file.originalPath, importedFilePath);
        if (file.kind === 'document') {
            writtenDocumentFilePaths.push(importedFilePath);
        }
    }
    return { localFilePathByOriginalPath, writtenDocumentFilePaths };
}

/**
 * Re-point an imported document's own canvas media at the local copies. The
 * document arrives holding the exporting machine's absolute paths, so without
 * this the slide renders an empty video box even though the file was bundled.
 */
async function applyImportedCanvasMedia(
    writtenDocumentFilePaths: string[],
    localFilePathByOriginalPath: Map<string, string>,
) {
    for (const documentFilePath of writtenDocumentFilePaths) {
        const jsonData = await readCanvasDocumentJson(documentFilePath);
        if (jsonData === null) {
            continue;
        }
        let isChanged = false;
        for (const canvasItem of iterateCanvasFileItems(jsonData)) {
            const localFilePath = localFilePathByOriginalPath.get(
                canvasItem.filePath,
            );
            if (
                localFilePath === undefined ||
                localFilePath === canvasItem.filePath
            ) {
                continue;
            }
            canvasItem.filePath = localFilePath;
            isChanged = true;
        }
        if (!isChanged) {
            continue;
        }
        await fsCreateFile(documentFilePath, JSON.stringify(jsonData), true);
        FileSource.getInstance(documentFilePath).fireUpdateEvent();
    }
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
        for (const pathRef of toItemPathRefs(item)) {
            const originalPath = pathRef.get();
            if (originalPath === null) {
                continue;
            }
            const localFilePath = localFilePathByOriginalPath.get(originalPath);
            if (localFilePath !== undefined) {
                pathRef.set(localFilePath);
            }
        }
        if (item.type === DragTypeEnum.BIBLE_ITEM) {
            await importBibleItem(item);
        }
    }
}

/**
 * Re-attach the backgrounds that were bundled with a document. Paths inside the
 * sidecar are corrected to the freshly imported copies, and stored the way the
 * app itself stores them (a bare file name while the file sits in the
 * configured folder). An existing sidecar is left alone rather than clobbered.
 */
async function importBackgroundMetas(
    extractDir: string,
    backgroundMetas: ArchiveBackgroundMetaType[],
    localFilePathByOriginalPath: Map<string, string>,
) {
    for (const backgroundMeta of backgroundMetas) {
        const documentFilePath = localFilePathByOriginalPath.get(
            backgroundMeta.documentOriginalPath,
        );
        if (documentFilePath === undefined) {
            continue;
        }
        const metaFilePath = `${documentFilePath}${BACKGROUND_META_DOT_EXTENSION}`;
        if (await fsCheckFileExist(metaFilePath)) {
            continue;
        }
        const extractedFilePath = toExtractedArchivePath(
            extractDir,
            backgroundMeta.archivePath,
        );
        if (!(await fsCheckFileExist(extractedFilePath))) {
            continue;
        }
        const metaData = parseJsonSafely(
            await fsReadFile(extractedFilePath),
            true,
        ) as {
            [key: string]: { type: string; item: unknown };
        } | null;
        if (metaData === null || typeof metaData !== 'object') {
            continue;
        }
        for (const value of Object.values(metaData)) {
            const kind = backgroundTypeKindMap[value?.type];
            if (kind === undefined || typeof value.item !== 'string') {
                continue;
            }
            const localFilePath = localFilePathByOriginalPath.get(value.item);
            if (localFilePath === undefined) {
                continue;
            }
            value.item =
                new BaseDirFileSource(
                    kindDirSettingNameMap[kind],
                    localFilePath,
                ).fileFullNameOrFilePath ?? localFilePath;
        }
        await fsCreateFile(metaFilePath, JSON.stringify(metaData), true);
        FileSource.getInstance(metaFilePath).fireUpdateEvent();
    }
}

export async function importPlaylistArchive(archiveFilePath: string) {
    const extractDir = await createWorkDir('owapl-import');
    try {
        await tarExtract(archiveFilePath, extractDir);
        const manifest = validateManifest(
            parseJsonSafely(
                await fsReadFile(pathJoin(extractDir, MANIFEST_FILE_NAME)),
                true,
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
        const { localFilePathByOriginalPath, writtenDocumentFilePaths } =
            await importArchiveFiles(extractDir, manifest.files, dirPathByKind);
        await applyImportedPaths(jsonData.items, localFilePathByOriginalPath);
        await applyImportedCanvasMedia(
            writtenDocumentFilePaths,
            localFilePathByOriginalPath,
        );
        await importBackgroundMetas(
            extractDir,
            manifest.backgroundMetas,
            localFilePathByOriginalPath,
        );
        const archiveFileName = pathBasename(archiveFilePath).replace(
            PLAYLIST_ARCHIVE_DOT_EXTENSION,
            '',
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
    return fileFullName
        .toLocaleLowerCase()
        .endsWith(PLAYLIST_ARCHIVE_DOT_EXTENSION);
}

/**
 * The imported playlist is named after the archive file (see
 * `importPlaylistArchive`), so the downloaded copy must keep the name the URL
 * carries — a random temp name would produce a playlist called after a UUID.
 * The name comes from a remote URL and is joined onto a temp path, so it goes
 * through the same sanitizing as an exported name.
 */
function toArchiveFileNameFromUrl(url: string) {
    const fileFullName = decodeURIComponent(
        pathBasename(new URL(url).pathname),
    );
    const name = checkIsPlaylistArchiveFileFullName(fileFullName)
        ? fileFullName.slice(0, -PLAYLIST_ARCHIVE_DOT_EXTENSION.length)
        : fileFullName.replace(/\.[^.]*$/, '');
    return toPlaylistArchiveFileName(name);
}

/**
 * Ask for a URL, stream the archive into a temp work dir, then hand it to the
 * same import the file picker and drop paths use. The bundle is deleted as soon
 * as it has been unpacked — it carries every media file the playlist uses and
 * can be big, so keeping a second copy around is wasted disk.
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
            toArchiveFileNameFromUrl(url),
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
