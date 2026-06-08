import { handleError } from '../../helper/errorHelpers';
import FileSource from '../../helper/FileSource';
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

export function toBibleNoteItemArchiveFileName(title: string) {
    const fileName = sanitizeFileNamePart(title).slice(0, 120);
    return `${fileName || 'BibleNoteItem'}${BIBLE_NOTE_ITEM_ARCHIVE_DOT_EXTENSION}`;
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

async function getArchiveOutputPath(noteItem: NoteItem) {
    const archiveFilePath = pathJoin(
        getDownloadPath(),
        toBibleNoteItemArchiveFileName(noteItem.title),
    );
    return await FileSource.getInstance(archiveFilePath).genNextFilePath();
}

export async function createBibleNoteItemArchive(noteItem: NoteItem) {
    const stagingDir = await createWorkDir('owabn-export');
    try {
        const archiveEntries = await writeArchiveFiles(noteItem, stagingDir);
        const archiveFilePath = await getArchiveOutputPath(noteItem);
        await tarCreate(stagingDir, archiveFilePath, archiveEntries, true);
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
        await tarExtract(archiveFilePath, extractDir);
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
    try {
        const archiveFilePath = await createBibleNoteItemArchive(noteItem);
        showSimpleToast(
            'Export Bible Note Item',
            `Exported to ${archiveFilePath}`,
        );
        showFileOrDirExplorer(archiveFilePath);
        return archiveFilePath;
    } catch (error: any) {
        handleError(error);
        showSimpleToast(
            'Export Bible Note Item',
            error?.message ?? 'Unable to export BibleNote item',
        );
        return null;
    }
}

export async function selectAndImportBibleNoteItemArchive(note: Note) {
    try {
        const filePaths = await selectFiles([
            {
                name: 'Open Worship BibleNote Archive',
                extensions: ['gz', 'tgz', 'tar'],
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
        showSimpleToast('Import Bible Note Item', `Imported ${noteItem.title}`);
        return noteItem;
    } catch (error: any) {
        handleError(error);
        showSimpleToast(
            'Import Bible Note Item',
            error?.message ?? 'Unable to import BibleNote item',
        );
        return null;
    }
}
