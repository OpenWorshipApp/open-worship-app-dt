// From the LEAF, not `appArchiveHelpers`: naming a bundle must not drag that
// module's collector graph — and the note editor's own dependencies behind it —
// into a file that only needs an extension and a free path.
import {
    PLAIN_ARCHIVE_TEMP_NAME,
    genNextArchiveFilePath,
    toArchiveDotExtension,
} from '../../helper/archiveNameHelpers';
import {
    askForNewArchivePassword,
    openArchiveForReading,
    protectArchiveFile,
} from '../../helper/archivePasswordHelpers';
import { handleError } from '../../helper/errorHelpers';
import { appLocalStorage } from '../../setting/directory-setting/appLocalStorage';
import {
    showFileOrDirExplorer,
    tarCreate,
    tarExtract,
} from '../../server/appHelpers';
import appProvider from '../../server/appProvider';
import {
    ensureDirectory,
    fsCheckFileExist,
    fsCloneFile,
    fsCopyFilePathToPath,
    fsCreateFile,
    fsDeleteDir,
    fsReadFile,
    getDownloadPath,
    getTempPath,
    pathBasename,
    pathJoin,
    selectFiles,
} from '../../server/fileHelpers';
import { showSimpleToast } from '../../toast/toastHelpers';
import { tran } from '../../lang/langHelpers';
import type Note from './Note';
import NoteItem from './NoteItem';
import { type NoteItemType } from './noteItemHelpers';

export const BIBLE_NOTE_ITEM_ARCHIVE_DOT_EXTENSION = '.owabn.tar.gz';

const MANIFEST_FILE_NAME = 'manifest.json';
const NOTE_ITEM_FILE_NAME = 'note-item.json';
const ARCHIVE_FILES_DIR = 'files';
const ARCHIVE_VERSION = 1;
const INVALID_FILE_NAME_CHAR_CODES = new Set([
    34, 42, 47, 58, 60, 62, 63, 92, 124,
]);
const EMBEDDED_FILE_PATH_KEYS = ['appFilePath', 'src'] as const;

type ArchiveFileEntry = {
    originalPath: string;
    archivePath: string;
};

type ArchiveManifest = {
    version: typeof ARCHIVE_VERSION;
    noteItem: string;
    files: ArchiveFileEntry[];
};

function parseJson(text: string) {
    const trimmedText = text.trim();
    if (!trimmedText.startsWith('{') && !trimmedText.startsWith('[')) {
        return null;
    }
    try {
        return JSON.parse(text) as unknown;
    } catch (error) {
        handleError(error);
        return null;
    }
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

function isUrlLike(value: string) {
    const lowerValue = value.toLowerCase();
    return (
        lowerValue.startsWith('http://') ||
        lowerValue.startsWith('https://') ||
        lowerValue.startsWith('data:') ||
        lowerValue.startsWith('blob:')
    );
}

function isLocalFilePath(value: string) {
    const trimmedValue = value.trim();
    if (trimmedValue.length === 0 || isUrlLike(trimmedValue)) {
        return false;
    }

    const firstCodePoint = trimmedValue.codePointAt(0);
    const secondCodePoint = trimmedValue.codePointAt(1);
    const thirdCodePoint = trimmedValue.codePointAt(2);
    const isWindowsDrivePath =
        firstCodePoint !== undefined &&
        ((firstCodePoint >= 65 && firstCodePoint <= 90) ||
            (firstCodePoint >= 97 && firstCodePoint <= 122)) &&
        secondCodePoint === 58 &&
        (thirdCodePoint === 47 || thirdCodePoint === 92);
    const isPosixAbsolutePath = firstCodePoint === 47;
    const isUncPath = firstCodePoint === 92 && secondCodePoint === 92;
    return isWindowsDrivePath || isPosixAbsolutePath || isUncPath;
}

function checkIsEmbeddedFilePathField(key: string, value: string) {
    if (key === 'appFilePath') {
        return value.length > 0;
    }
    return key === 'src' && isLocalFilePath(value);
}

export function toBibleNoteItemArchiveFileName(
    title: string,
    password: string | null = null,
) {
    const fileName = sanitizeFileNamePart(title).slice(0, 120);
    const dotExtension = toArchiveDotExtension(
        BIBLE_NOTE_ITEM_ARCHIVE_DOT_EXTENSION,
        password,
    );
    return `${fileName || 'BibleNoteItem'}${dotExtension}`;
}

function toFileNameSafeBase64(value: string) {
    return appProvider.appUtils.base64Encode(value).split('/').join('_');
}

function getDotExtensionFromFilePath(filePath: string) {
    const fileName = pathBasename(filePath);
    const dotIndex = fileName.lastIndexOf('.');
    if (dotIndex <= 0 || dotIndex === fileName.length - 1) {
        return '';
    }
    return fileName.slice(dotIndex);
}

export function toBibleNoteItemTmpFileName(
    noteName: string,
    noteItemId: number,
    filePath: string,
    timestamp = Date.now(),
) {
    const encodedTrace = toFileNameSafeBase64(
        `${noteName}/${noteItemId}/${timestamp}`,
    );
    return `bn-${encodedTrace}${getDotExtensionFromFilePath(filePath)}`;
}

function collectAppFilePaths(
    value: unknown,
    paths: string[],
    seenPaths: Set<string>,
) {
    if (Array.isArray(value)) {
        value.forEach((child) => {
            collectAppFilePaths(child, paths, seenPaths);
        });
        return;
    }
    if (value === null || typeof value !== 'object') {
        return;
    }

    const objectValue = value as Record<string, unknown>;
    for (const key of EMBEDDED_FILE_PATH_KEYS) {
        const embeddedFilePath = objectValue[key];
        if (
            typeof embeddedFilePath === 'string' &&
            checkIsEmbeddedFilePathField(key, embeddedFilePath) &&
            !seenPaths.has(embeddedFilePath)
        ) {
            seenPaths.add(embeddedFilePath);
            paths.push(embeddedFilePath);
        }
    }
    Object.values(objectValue).forEach((child) => {
        collectAppFilePaths(child, paths, seenPaths);
    });
}

export function collectLexicalAppFilePaths(content: string) {
    const jsonData = parseJson(content);
    if (jsonData === null) {
        return [];
    }
    const paths: string[] = [];
    collectAppFilePaths(jsonData, paths, new Set<string>());
    return paths;
}

function rewriteAppFilePaths(
    value: unknown,
    appFilePathByOriginalPath: Map<string, string>,
) {
    let isChanged = false;
    if (Array.isArray(value)) {
        value.forEach((child) => {
            isChanged =
                rewriteAppFilePaths(child, appFilePathByOriginalPath) ||
                isChanged;
        });
        return isChanged;
    }
    if (value === null || typeof value !== 'object') {
        return false;
    }

    const objectValue = value as Record<string, unknown>;
    for (const key of EMBEDDED_FILE_PATH_KEYS) {
        const embeddedFilePath = objectValue[key];
        if (typeof embeddedFilePath !== 'string') {
            continue;
        }
        const importedPath = appFilePathByOriginalPath.get(embeddedFilePath);
        if (importedPath !== undefined) {
            objectValue[key] = importedPath;
            isChanged = true;
        }
    }
    Object.values(objectValue).forEach((child) => {
        isChanged =
            rewriteAppFilePaths(child, appFilePathByOriginalPath) || isChanged;
    });
    return isChanged;
}

export function rewriteLexicalAppFilePaths(
    content: string,
    appFilePathByOriginalPath: Map<string, string>,
) {
    const jsonData = parseJson(content);
    if (jsonData === null) {
        return content;
    }
    if (!rewriteAppFilePaths(jsonData, appFilePathByOriginalPath)) {
        return content;
    }
    return JSON.stringify(jsonData);
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

async function writeArchiveFiles(noteItem: NoteItem, stagingDir: string) {
    await fsCreateFile(
        pathJoin(stagingDir, NOTE_ITEM_FILE_NAME),
        JSON.stringify(noteItem.toJson(), null, 2),
        true,
    );

    const embeddedFilePaths = collectLexicalAppFilePaths(noteItem.content);
    const archiveFiles: ArchiveFileEntry[] = [];
    if (embeddedFilePaths.length > 0) {
        const filesDir = pathJoin(stagingDir, ARCHIVE_FILES_DIR);
        await ensureDirectory(filesDir);
        for (const [index, embeddedFilePath] of embeddedFilePaths.entries()) {
            if (!(await fsCheckFileExist(embeddedFilePath))) {
                throw new Error(`Embedded file not found: ${embeddedFilePath}`);
            }
            const archiveFileName = toArchiveFileName(index, embeddedFilePath);
            await fsCloneFile(
                embeddedFilePath,
                pathJoin(filesDir, archiveFileName),
            );
            archiveFiles.push({
                originalPath: embeddedFilePath,
                archivePath: `${ARCHIVE_FILES_DIR}/${archiveFileName}`,
            });
        }
    }

    const manifest: ArchiveManifest = {
        version: ARCHIVE_VERSION,
        noteItem: NOTE_ITEM_FILE_NAME,
        files: archiveFiles,
    };
    await fsCreateFile(
        pathJoin(stagingDir, MANIFEST_FILE_NAME),
        JSON.stringify(manifest, null, 2),
        true,
    );
    return [
        MANIFEST_FILE_NAME,
        NOTE_ITEM_FILE_NAME,
        ...(archiveFiles.length > 0 ? [ARCHIVE_FILES_DIR] : []),
    ];
}

// `genNextArchiveFilePath`, not `FileSource.genNextFilePath()`: the latter
// splits a name on its LAST dot, so a second export came back as
// `Title.owabn.tar (1).gz` — a name that no longer ends in the extension the
// import gate matches on. This was the last archive writer still doing that.
async function getArchiveOutputPath(
    noteItem: NoteItem,
    password: string | null,
) {
    return await genNextArchiveFilePath(
        getDownloadPath(),
        toBibleNoteItemArchiveFileName(noteItem.title, password),
        toArchiveDotExtension(BIBLE_NOTE_ITEM_ARCHIVE_DOT_EXTENSION, password),
    );
}

export async function createBibleNoteItemArchive(
    noteItem: NoteItem,
    password: string | null = null,
) {
    const stagingDir = await createWorkDir('owabn-export');
    try {
        const archiveEntries = await writeArchiveFiles(noteItem, stagingDir);
        const archiveFilePath = await getArchiveOutputPath(noteItem, password);
        // Protecting one means tar writes into the staging dir that is deleted
        // in `finally` anyway, so the plain copy never outlives the call.
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

function validateManifest(jsonData: unknown): ArchiveManifest {
    if (jsonData === null || typeof jsonData !== 'object') {
        throw new Error('Invalid BibleNote item archive manifest');
    }
    const manifest = jsonData as Partial<ArchiveManifest>;
    if (
        manifest.version !== ARCHIVE_VERSION ||
        typeof manifest.noteItem !== 'string' ||
        !Array.isArray(manifest.files)
    ) {
        throw new Error('Invalid BibleNote item archive manifest');
    }
    const files = manifest.files.map((file) => {
        if (
            typeof file?.originalPath !== 'string' ||
            typeof file?.archivePath !== 'string'
        ) {
            throw new TypeError('Invalid BibleNote item archive file entry');
        }
        return {
            originalPath: file.originalPath,
            archivePath: file.archivePath,
        };
    });
    return {
        version: ARCHIVE_VERSION,
        noteItem: manifest.noteItem,
        files,
    };
}

async function readManifest(extractDir: string) {
    const manifestText = await fsReadFile(
        pathJoin(extractDir, MANIFEST_FILE_NAME),
    );
    return validateManifest(parseJson(manifestText));
}

function toExtractedArchivePath(extractDir: string, archivePath: string) {
    const parts = archivePath.split('/').filter((part) => part.length > 0);
    if (
        parts.length === 0 ||
        parts.some((part) => part === '..' || part.includes('\\'))
    ) {
        throw new Error('Invalid BibleNote item archive file path');
    }
    return pathJoin(extractDir, ...parts);
}

async function copyImportedEmbeddedFiles(
    extractDir: string,
    files: ArchiveFileEntry[],
    note: Note,
    noteItemId: number,
    timestamp: number,
) {
    const tmpFilesDir = appLocalStorage.tmpFilesDir;
    await ensureDirectory(tmpFilesDir);
    const appFilePathByOriginalPath = new Map<string, string>();
    for (const file of files) {
        const extractedFilePath = toExtractedArchivePath(
            extractDir,
            file.archivePath,
        );
        if (!(await fsCheckFileExist(extractedFilePath))) {
            throw new Error(`Archive file not found: ${file.archivePath}`);
        }
        const importedFilePath = await fsCopyFilePathToPath(
            extractedFilePath,
            tmpFilesDir,
            toBibleNoteItemTmpFileName(
                note.fileSource.name,
                noteItemId,
                file.originalPath || file.archivePath,
                timestamp,
            ),
        );
        if (importedFilePath === null) {
            throw new Error(
                `Unable to import archive file: ${file.archivePath}`,
            );
        }
        appFilePathByOriginalPath.set(file.originalPath, importedFilePath);
    }
    return appFilePathByOriginalPath;
}

export async function importBibleNoteItemArchive(
    note: Note,
    archiveFilePath: string,
) {
    const extractDir = await createWorkDir(
        'owabn-import',
        appLocalStorage.tmpFilesDir,
    );
    try {
        // A protected bundle is decrypted into the same work dir this is
        // already unpacking into, so `safeDeleteDir` below carries the plain
        // copy away with everything else.
        const readableArchive = await openArchiveForReading(
            archiveFilePath,
            extractDir,
            'Import Bible Note Item',
        );
        if (readableArchive === null) {
            return null;
        }
        await tarExtract(readableArchive.filePath, extractDir);
        const manifest = await readManifest(extractDir);
        const noteItemText = await fsReadFile(
            pathJoin(extractDir, manifest.noteItem),
        );
        const noteItemJson = JSON.parse(noteItemText) as NoteItemType;
        const noteItemId = note.maxItemId + 1;
        const timestamp = Date.now();
        noteItemJson.metadata.id = noteItemId;
        const appFilePathByOriginalPath = await copyImportedEmbeddedFiles(
            extractDir,
            manifest.files,
            note,
            noteItemId,
            timestamp,
        );
        noteItemJson.content = rewriteLexicalAppFilePaths(
            noteItemJson.content,
            appFilePathByOriginalPath,
        );

        const noteItem = NoteItem.fromJson(noteItemJson);
        const isSaved = await note.addAndSaveNoteItem(noteItem);
        if (!isSaved) {
            throw new Error('Unable to save imported BibleNote item');
        }
        return noteItem;
    } finally {
        await safeDeleteDir(extractDir);
    }
}

export async function exportBibleNoteItem(noteItem: NoteItem) {
    // One dialog, always — an empty answer writes exactly the bundle this
    // export has always written; cancelling backs out of the whole thing.
    const password = await askForNewArchivePassword(
        tran('Export Bible Note Item'),
    );
    if (password === null) {
        return null;
    }
    try {
        const archiveFilePath = await createBibleNoteItemArchive(
            noteItem,
            password || null,
        );
        showSimpleToast(
            tran('Export Bible Note Item'),
            `Exported to ${archiveFilePath}`,
        );
        showFileOrDirExplorer(archiveFilePath);
        return archiveFilePath;
    } catch (error: any) {
        handleError(error);
        showSimpleToast(
            tran('Export Bible Note Item'),
            error?.message ?? tran('Unable to export BibleNote item'),
        );
        return null;
    }
}

export async function selectAndImportBibleNoteItemArchive(note: Note) {
    try {
        const filePaths = await selectFiles([
            {
                name: 'Open Worship BibleNote Archive',
                // `enc` is the password protected shape of the same bundle.
                extensions: ['gz', 'tgz', 'tar', 'enc'],
            },
        ]);
        const archiveFilePath = filePaths[0];
        if (!archiveFilePath) {
            return null;
        }
        const noteItem = await importBibleNoteItemArchive(
            note,
            archiveFilePath,
        );
        // `null` is the password prompt being cancelled — the operator already
        // knows they backed out, so it gets no toast.
        if (noteItem === null) {
            return null;
        }
        showSimpleToast(
            tran('Import Bible Note Item'),
            `Imported ${noteItem.title}`,
        );
        return noteItem;
    } catch (error: any) {
        handleError(error);
        showSimpleToast(
            tran('Import Bible Note Item'),
            error?.message ?? tran('Unable to import BibleNote item'),
        );
        return null;
    }
}
