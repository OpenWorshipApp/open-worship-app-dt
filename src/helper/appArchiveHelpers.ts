import { dirSourceSettingNames } from './constants';
import DirSource from './DirSource';
import { DragTypeEnum } from './DragInf';
import { handleError } from './errorHelpers';
import FileSource from './FileSource';
import { parseJsonSafely } from './helpers';
import {
    ensureDirectory,
    fsCheckFileExist,
    fsCloneFile,
    fsCopyFilePathToPath,
    fsCreateFile,
    fsDeleteDir,
    fsGetFileSize,
    fsReadFile,
    getFileMD5,
    getTempPath,
    pathBasename,
    pathJoin,
} from '../server/fileHelpers';
import { BaseDirFileSource } from '../setting/directory-setting/directoryHelpers';
import { checkIsRemoteMediaSource } from './mediaSourceHelpers';

/**
 * The machinery shared by every "bundle this thing with everything it needs"
 * archive — a playlist (`src/playlist/playlistArchiveHelpers.ts`) and a single
 * document (`src/app-document-list/appDocumentArchiveHelpers.ts`). Both produce
 * a `.tar.gz` holding `manifest.json` + `files/`, and both have to re-create the
 * same native files on the other machine, so the collecting and the re-pointing
 * live here rather than being written twice and drifting apart.
 */

export const MANIFEST_FILE_NAME = 'manifest.json';
export const ARCHIVE_FILES_DIR = 'files';
export const ARCHIVE_VERSION = 1;
export const BACKGROUND_META_DOT_EXTENSION = '.bg.json';
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
export type ArchiveFileKindType =
    'document' | 'bible' | 'image' | 'video' | 'audio' | 'web';

export const kindDirSettingNameMap: Record<ArchiveFileKindType, string> = {
    document: dirSourceSettingNames.APP_DOCUMENT,
    // For `bible` this is only a fallback: that list's folder is
    // page-dependent (`Bible.getDirSourceSettingName()` reads `BIBLE_READ` on
    // the reader page), so the bible bundle pre-resolves its own destination and
    // passes it to `resolveKindDirPaths`.
    bible: dirSourceSettingNames.BIBLE_PRESENT,
    image: dirSourceSettingNames.BACKGROUND_IMAGE,
    video: dirSourceSettingNames.BACKGROUND_VIDEO,
    audio: dirSourceSettingNames.BACKGROUND_AUDIO,
    web: dirSourceSettingNames.BACKGROUND_WEB,
};

// The kinds that are an APP ITEM rather than a media file: the ones an import
// may rewrite afterwards (canvas media re-pointing, color notes) and whose
// sidecar is re-attached.
const ITEM_FILE_KINDS = new Set<ArchiveFileKindType>(['document', 'bible']);

export type ArchiveFileEntryType = {
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
export type ArchiveBackgroundMetaType = {
    documentOriginalPath: string;
    archivePath: string;
};

/**
 * Which folder a media entry belongs in, by drag type. Used for both halves of
 * the job — a playlist entry's own payload and the entries inside a document's
 * background sidecar — so the two can never disagree about where a file goes.
 * (A sidecar never holds audio; listing it costs nothing and keeps one map.)
 */
export const backgroundTypeKindMap: { [key: string]: ArchiveFileKindType } = {
    [DragTypeEnum.BACKGROUND_IMAGE]: 'image',
    [DragTypeEnum.BACKGROUND_VIDEO]: 'video',
    [DragTypeEnum.BACKGROUND_AUDIO]: 'audio',
    [DragTypeEnum.BACKGROUND_WEB]: 'web',
};

export function sanitizeFileNamePart(value: string) {
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

export function toArchiveFileName(
    name: string,
    dotExtension: string,
    fallbackName: string,
) {
    const fileName = sanitizeFileNamePart(name).slice(0, 120);
    return `${fileName || fallbackName}${dotExtension}`;
}

/**
 * The next free path for an archive, de-duplicated as `<name> (1)<dotExtension>`.
 *
 * NOT `FileSource.genNextFilePath()`: that splits a name on its LAST dot, so a
 * multi-part archive extension came back as `service.owapl.tar (1).gz` — a name
 * that no longer ends in `.owapl.tar.gz`, which the drop-import gate then
 * refused. Exporting the same playlist twice therefore produced a bundle the app
 * itself had written and would not take back, in silence. Every archive
 * extension is known at the call site, so it is kept whole here.
 */
export async function genNextArchiveFilePath(
    dirPath: string,
    fileFullName: string,
    dotExtension: string,
) {
    const baseName = fileFullName
        .toLocaleLowerCase()
        .endsWith(dotExtension.toLocaleLowerCase())
        ? fileFullName.slice(0, -dotExtension.length)
        : fileFullName;
    let filePath = pathJoin(dirPath, `${baseName}${dotExtension}`);
    let i = 0;
    while (await fsCheckFileExist(filePath)) {
        i++;
        filePath = pathJoin(dirPath, `${baseName} (${i})${dotExtension}`);
    }
    return filePath;
}

/**
 * The tail of an archive file name, in BOTH the shapes that exist on disk.
 *
 * The canonical one is `<name><dotExtension>`. The other is what older builds
 * wrote for a second export: the de-duplicating suffix went in before the LAST
 * dot, giving `service.owapl.tar (1).gz`. Those bundles are already sitting in
 * people's Downloads folders, so every place that recognises an archive name has
 * to know the shape — refusing it is what made a dropped bundle do nothing at
 * all, and failing to strip it is what named the imported playlist
 * `service.owapl.tar (1)`.
 */
function toArchiveFileNameRegex(dotExtension: string) {
    const escape = (text: string) =>
        text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const lastDotIndex = dotExtension.lastIndexOf('.');
    const head = escape(dotExtension.slice(0, lastDotIndex));
    const tail = escape(dotExtension.slice(lastDotIndex));
    return new RegExp(`${head}(\\s*\\(\\d+\\))?${tail}$`, 'i');
}

/** Whether a file name is an archive of this kind. */
export function checkIsArchiveFileFullName(
    fileFullName: string,
    dotExtension: string,
) {
    return toArchiveFileNameRegex(dotExtension).test(fileFullName);
}

/** The archive's name without its extension, whichever shape that took. */
export function toArchiveBaseName(fileFullName: string, dotExtension: string) {
    return fileFullName.replace(toArchiveFileNameRegex(dotExtension), '');
}

function createWorkDirName(prefix: string) {
    const randomId =
        globalThis.crypto?.randomUUID?.() ??
        `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return `${prefix}-${randomId}`;
}

export async function createWorkDir(prefix: string, baseDir = getTempPath()) {
    const workDir = pathJoin(baseDir, createWorkDirName(prefix));
    await ensureDirectory(workDir);
    return workDir;
}

export async function safeDeleteDir(dirPath: string) {
    try {
        await fsDeleteDir(dirPath);
    } catch (error) {
        handleError(error);
    }
}

function toArchiveEntryName(index: number, filePath: string) {
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
 * inlines its pixels as base64 and so travels inside the document itself, but
 * VIDEO and AUDIO boxes only store `filePath` (inlining them would balloon the
 * document) — so those files have to be bundled separately, or the slide
 * arrives on the other machine with a dead video/audio box. A box whose source
 * is a remote link is skipped: the link travels inside the document and already
 * resolves anywhere.
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
                (canvasItem?.type === 'video' ||
                    canvasItem?.type === 'audio') &&
                typeof canvasItem.filePath === 'string' &&
                canvasItem.filePath.length > 0 &&
                !checkIsRemoteMediaSource(canvasItem.filePath)
            ) {
                yield canvasItem as {
                    filePath: string;
                    type: 'video' | 'audio';
                };
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

export class ArchiveFileCollector {
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
        return `${ARCHIVE_FILES_DIR}/${toArchiveEntryName(index, originalPath)}`;
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
            await this.addFile(canvasItem.filePath, canvasItem.type);
        }
    }

    /**
     * Everything that hangs off a document: its attached-background sidecar
     * (plus that sidecar's media) and the media its own canvas points at.
     */
    async addDocument(
        documentOriginalPath: string | null,
        kind: ArchiveFileKindType = 'document',
    ) {
        if (!(await this.addFile(documentOriginalPath, kind))) {
            return false;
        }
        const filePath = documentOriginalPath as string;
        await this.addBackgroundMeta(filePath);
        await this.addCanvasDocumentMedia(filePath);
        return true;
    }
}

/**
 * Lay the collected files out in the staging directory. Returns the archive
 * entry names to hand to `tarCreate`, with `extraEntries` (the caller's own
 * `playlist.json` and the like) first.
 */
export async function stageArchiveFiles(
    collector: ArchiveFileCollector,
    stagingDir: string,
    extraEntries: string[],
) {
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
    return {
        archiveFiles,
        archiveEntries: [
            MANIFEST_FILE_NAME,
            ...extraEntries,
            ...(hasFiles ? [ARCHIVE_FILES_DIR] : []),
        ],
    };
}

export async function writeArchiveManifest(
    stagingDir: string,
    manifest: object,
) {
    await fsCreateFile(
        pathJoin(stagingDir, MANIFEST_FILE_NAME),
        JSON.stringify(manifest, null, 2),
        true,
    );
}

/**
 * `invalidMessage` is required because a bundle with NO `manifest.json` is the
 * ordinary way a wrong file gets dropped in, and it must read as "this is not
 * one of ours" rather than as a crash. Reading first and validating later let
 * `fsReadFile` throw its own `ENOENT: … \owapl-import-<uuid>\manifest.json`
 * straight at the operator — a developer string naming a temp folder that no
 * longer exists by the time they read it.
 */
export async function readArchiveManifest(
    extractDir: string,
    invalidMessage: string,
) {
    const manifestFilePath = pathJoin(extractDir, MANIFEST_FILE_NAME);
    if (!(await fsCheckFileExist(manifestFilePath))) {
        throw new Error(invalidMessage);
    }
    return parseJsonSafely(await fsReadFile(manifestFilePath), true);
}

export function validateArchiveFileEntries(
    files: unknown,
    invalidMessage: string,
): ArchiveFileEntryType[] {
    if (!Array.isArray(files)) {
        throw new TypeError(invalidMessage);
    }
    return files.map((file) => {
        if (
            typeof file?.originalPath !== 'string' ||
            typeof file?.archivePath !== 'string' ||
            !(file?.kind in kindDirSettingNameMap)
        ) {
            throw new TypeError(invalidMessage);
        }
        return {
            originalPath: file.originalPath,
            archivePath: file.archivePath,
            kind: file.kind as ArchiveFileKindType,
        };
    });
}

export function validateArchiveBackgroundMetas(
    backgroundMetas: unknown,
): ArchiveBackgroundMetaType[] {
    if (!Array.isArray(backgroundMetas)) {
        return [];
    }
    return backgroundMetas.filter((backgroundMeta) => {
        return (
            typeof backgroundMeta?.documentOriginalPath === 'string' &&
            typeof backgroundMeta?.archivePath === 'string'
        );
    });
}

export function toExtractedArchivePath(
    extractDir: string,
    archivePath: string,
) {
    const parts = archivePath.split('/').filter((part) => part.length > 0);
    if (
        parts.length === 0 ||
        parts.some((part) => part === '..' || part.includes('\\'))
    ) {
        throw new Error('Invalid archive file path');
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
 * imported and nothing to show for it.
 */
export function resolveKindDirPaths(
    files: ArchiveFileEntryType[],
    // A feature whose folder is not a plain constant (the bible list's is
    // page-dependent) seeds its own kind here rather than teaching the map
    // about that rule.
    presetDirPathByKind?: Map<ArchiveFileKindType, string>,
) {
    const dirPathByKind = new Map<ArchiveFileKindType, string>(
        presetDirPathByKind,
    );
    for (const file of files) {
        if (!dirPathByKind.has(file.kind)) {
            dirPathByKind.set(file.kind, getKindDirPath(file.kind));
        }
    }
    return dirPathByKind;
}

/**
 * Whether two files hold the same bytes. Same name is NOT the same file: two
 * machines can each hold an `a.mp4` that is a different video, and silently
 * treating them as one would quietly project the wrong clip — so the CONTENTS
 * decide.
 *
 * Sizes are compared first because that is a stat rather than a read: a
 * differing size is a free "no", which is the common answer when a name
 * collides by accident. Only a size match pays for MD5, which is streamed
 * (`getFileChecksum`), so a big video is never held in memory.
 *
 * An unreadable file on either side leaves the answer unknown. Reading that as
 * "same" could hide the wrong video behind the right name, so the safe reading
 * is "different": the operator ends up with one extra copy rather than a
 * service that projects the wrong thing.
 */
export async function checkIsSameFileContent(
    filePath: string,
    otherFilePath: string,
) {
    try {
        const [size, otherSize] = await Promise.all([
            fsGetFileSize(filePath),
            fsGetFileSize(otherFilePath),
        ]);
        if (size !== otherSize) {
            return false;
        }
    } catch (error) {
        handleError(error);
        return false;
    }
    const [md5, otherMd5] = await Promise.all([
        getFileMD5(filePath),
        getFileMD5(otherFilePath),
    ]);
    return md5 !== null && md5 === otherMd5;
}

/**
 * What an import does when the destination folder ALREADY holds a file of this
 * name. Keyed by the destination folder rather than by archive kind, because
 * the whole-data restore (`src/setting/data-archive/dataArchiveHelpers.ts`)
 * knows folders and the per-item bundles know kinds — one map means the two can
 * never disagree about what happens to the operator's files.
 */
export type ImportCollisionPolicyType =
    'always-new' | 'merge-items' | 'reuse-if-same';

const collisionPolicyBySettingName: {
    [key: string]: ImportCollisionPolicyType;
} = {
    // The operator's own authored files. One arriving under a name they already
    // use is neither folded into theirs nor skipped: it lands beside it as
    // `name (1).ows`, because sharing a name is not being the same work — and
    // quietly dropping an imported document is the one outcome that loses it.
    [dirSourceSettingNames.APP_DOCUMENT]: 'always-new',
    [dirSourceSettingNames.PLAYLIST]: 'always-new',
    [dirSourceSettingNames.BIBLE_NOTES]: 'always-new',
    // A bible list is a LIST of verse references, so two of the same name
    // become one rather than two: verses the local list is missing are appended
    // to it, and everything already there is left exactly as it is.
    [dirSourceSettingNames.BIBLE_PRESENT]: 'merge-items',
    [dirSourceSettingNames.BIBLE_READ]: 'merge-items',
};

/**
 * Media falls through to here: an identical file is reused rather than
 * duplicated, because the alternative is a second copy of a gigabyte video on a
 * machine that is usually tight on disk. Different contents under the same name
 * still land beside it as `a (1).mp4`.
 */
const DEFAULT_COLLISION_POLICY: ImportCollisionPolicyType = 'reuse-if-same';

export function getImportCollisionPolicy(settingName: string) {
    return (
        collisionPolicyBySettingName[settingName] ?? DEFAULT_COLLISION_POLICY
    );
}

/**
 * What makes two verse entries THE SAME entry: the translation plus the exact
 * range. Two entries differing only by translation are different things to
 * project, so `bibleKey` is part of the identity — this is
 * `BibleItem.checkIsTargetIdentical`'s range comparison plus the key that range
 * is read in.
 */
function toBibleItemKey(itemJson: any) {
    const target = itemJson?.target ?? {};
    return JSON.stringify([
        itemJson?.bibleKey ?? '',
        target.bookKey ?? '',
        target.chapter ?? 0,
        target.verseStart ?? 0,
        target.verseEnd ?? 0,
    ]);
}

/**
 * Fold an archived bible list into the local one of the same name. Verses the
 * local list does not already hold are appended; everything already there is
 * left untouched, including the operator's own per-verse color notes (those
 * live inside each item's `metadata`, so an appended verse brings its own).
 *
 * Returns false when either side cannot be read as a bible list, so the caller
 * falls back to writing the archived list as a NEW file rather than silently
 * dropping it.
 *
 * The JSON is walked rather than loaded through `Bible`: a merge must not pay
 * for building the model, and importing the bible list from here would close a
 * module cycle — the same reason `iterateCanvasFileItems` walks a document.
 */
async function mergeBibleListInto(
    localFilePath: string,
    extractedFilePath: string,
) {
    try {
        const localJson = parseJsonSafely(
            await fsReadFile(localFilePath),
            true,
        ) as { items?: unknown } | null;
        const archivedJson = parseJsonSafely(
            await fsReadFile(extractedFilePath),
            true,
        ) as { items?: unknown } | null;
        if (
            localJson === null ||
            archivedJson === null ||
            !Array.isArray(localJson.items) ||
            !Array.isArray(archivedJson.items)
        ) {
            return false;
        }
        const localItems = localJson.items as any[];
        const seenKeys = new Set(localItems.map(toBibleItemKey));
        // An id only has to be unique inside its own file, and the local ones
        // are already in use, so appended verses continue past the highest.
        let nextId = localItems.reduce((maxId: number, itemJson: any) => {
            return Math.max(
                maxId,
                typeof itemJson?.id === 'number' ? itemJson.id : 0,
            );
        }, 0);
        let addedCount = 0;
        for (const itemJson of archivedJson.items as any[]) {
            const itemKey = toBibleItemKey(itemJson);
            if (seenKeys.has(itemKey)) {
                continue;
            }
            seenKeys.add(itemKey);
            nextId += 1;
            localItems.push({ ...itemJson, id: nextId });
            addedCount += 1;
        }
        if (addedCount > 0) {
            await fsCreateFile(localFilePath, JSON.stringify(localJson), true);
            FileSource.getInstance(localFilePath).fireUpdateEvent();
        }
        return true;
    } catch (error) {
        handleError(error);
        return false;
    }
}

/**
 * The local file this archived one should be folded into, or null when it has
 * to be written as a new file (which `fsCopyFilePathToPath` lands beside any
 * namesake as `a (1).mp4` via `genNextFilePath`).
 */
export async function findExistingLocalFile(
    policy: ImportCollisionPolicyType,
    extractedFilePath: string,
    destinationFilePath: string,
) {
    if (
        policy === 'always-new' ||
        !(await fsCheckFileExist(destinationFilePath))
    ) {
        return null;
    }
    if (policy === 'merge-items') {
        return (await mergeBibleListInto(
            destinationFilePath,
            extractedFilePath,
        ))
            ? destinationFilePath
            : null;
    }
    return (await checkIsSameFileContent(
        destinationFilePath,
        extractedFilePath,
    ))
        ? destinationFilePath
        : null;
}

/**
 * Re-create the native files the archive carries, each according to what its
 * destination folder does with a name it already holds — see
 * `collisionPolicyBySettingName`: a document always becomes a new file, a bible
 * list is merged into the local one, and media is reused when identical.
 */
export async function importArchiveFiles(
    extractDir: string,
    files: ArchiveFileEntryType[],
    dirPathByKind: Map<ArchiveFileKindType, string>,
) {
    const localFilePathByOriginalPath = new Map<string, string>();
    // Only the app items this import actually WROTE may be rewritten
    // afterwards; one folded into an existing file is the operator's own and is
    // left alone, exactly as an existing `.bg.json` sidecar is.
    const writtenItemFilePaths: string[] = [];
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
        const existingFilePath = await findExistingLocalFile(
            getImportCollisionPolicy(kindDirSettingNameMap[file.kind]),
            extractedFilePath,
            pathJoin(dirPath, fileFullName),
        );
        if (existingFilePath !== null) {
            localFilePathByOriginalPath.set(
                file.originalPath,
                existingFilePath,
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
        if (ITEM_FILE_KINDS.has(file.kind)) {
            writtenItemFilePaths.push(importedFilePath);
        }
    }
    return { localFilePathByOriginalPath, writtenItemFilePaths };
}

/**
 * Re-point an imported document's own canvas media at the local copies. The
 * document arrives holding the exporting machine's absolute paths, so without
 * this the slide renders an empty video box even though the file was bundled.
 */
export async function applyImportedCanvasMedia(
    writtenItemFilePaths: string[],
    localFilePathByOriginalPath: Map<string, string>,
) {
    for (const documentFilePath of writtenItemFilePaths) {
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
 * Re-attach the backgrounds that were bundled with a document. Paths inside the
 * sidecar are corrected to the freshly imported copies, and stored the way the
 * app itself stores them (a bare file name while the file sits in the
 * configured folder). An existing sidecar is left alone rather than clobbered.
 */
export async function importBackgroundMetas(
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

/**
 * The file name an archive downloaded from a URL should be saved under. The
 * name comes from a remote URL and is joined onto a temp path, so it goes
 * through the same sanitizing as an exported name.
 */
export function toArchiveFileNameFromUrl(
    url: string,
    dotExtension: string,
    fallbackName: string,
) {
    const fileFullName = decodeURIComponent(
        pathBasename(new URL(url).pathname),
    );
    const name = fileFullName.toLocaleLowerCase().endsWith(dotExtension)
        ? fileFullName.slice(0, -dotExtension.length)
        : fileFullName.replace(/\.[^.]*$/, '');
    return toArchiveFileName(name, dotExtension, fallbackName);
}
