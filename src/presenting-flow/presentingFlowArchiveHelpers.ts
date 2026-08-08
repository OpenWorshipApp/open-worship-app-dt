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
import type { PresentingFlowType } from './PresentingFlow';
import PresentingFlow from './PresentingFlow';
import type { PresentingFlowItemType } from './PresentingFlowItem';
import { slideDragTypeList } from './PresentingFlowItem';
import type {
    ArchiveBackgroundMetaType,
    ArchiveFileEntryType,
    ArchiveFileKindType,
} from '../helper/appArchiveHelpers';
import {
    ARCHIVE_VERSION,
    ArchiveFileCollector,
    PLAIN_ARCHIVE_TEMP_NAME,
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
    toArchiveDotExtension,
    toArchiveFileName,
    toArchiveFileNameFromUrl,
    toExtractedArchivePath,
    validateArchiveBackgroundMetas,
    validateArchiveFileEntries,
    writeArchiveManifest,
} from '../helper/appArchiveHelpers';
import {
    askForNewArchivePassword,
    openArchiveForReading,
    protectArchiveFile,
} from '../helper/archivePasswordHelpers';

export const PRESENTING_FLOW_ARCHIVE_DOT_EXTENSION = '.owapf.tar.gz';

const PRESENTING_FLOW_FILE_NAME = 'presentingFlow.json';
const FALLBACK_NAME = 'PresentingFlow';

type ArchiveManifestType = {
    version: typeof ARCHIVE_VERSION;
    presentingFlow: string;
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
 * Every json a presenting flow entry OWNS — which is the entry, and only the entry.
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
function* iteratePresentingFlowItemJsons(
    item: PresentingFlowItemType,
): Generator<PresentingFlowItemType> {
    yield item;
}

function toItemPathRefs(item: PresentingFlowItemType): PathRefType[] {
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

export function toPresentingFlowArchiveFileName(
    name: string,
    password: string | null = null,
) {
    return toArchiveFileName(
        name,
        toArchiveDotExtension(PRESENTING_FLOW_ARCHIVE_DOT_EXTENSION, password),
        FALLBACK_NAME,
    );
}

async function collectArchiveFiles(items: PresentingFlowItemType[]) {
    const collector = new ArchiveFileCollector();
    for (const item of items) {
        for (const itemJson of iteratePresentingFlowItemJsons(item)) {
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

async function writeArchiveFiles(
    jsonData: PresentingFlowType,
    stagingDir: string,
) {
    await fsCreateFile(
        pathJoin(stagingDir, PRESENTING_FLOW_FILE_NAME),
        JSON.stringify(jsonData, null, 2),
        true,
    );
    const collector = await collectArchiveFiles(jsonData.items);
    const { archiveFiles, archiveEntries } = await stageArchiveFiles(
        collector,
        stagingDir,
        [PRESENTING_FLOW_FILE_NAME],
    );
    const manifest: ArchiveManifestType = {
        version: ARCHIVE_VERSION,
        presentingFlow: PRESENTING_FLOW_FILE_NAME,
        files: archiveFiles,
        backgroundMetas: collector.backgroundMetas,
    };
    await writeArchiveManifest(stagingDir, manifest);
    return archiveEntries;
}

export async function createPresentingFlowArchive(
    presentingFlow: PresentingFlow,
    password: string | null = null,
) {
    const jsonData = await presentingFlow.getJsonData();
    if (jsonData === null) {
        throw new Error('Unable to read the presenting flow');
    }
    const stagingDir = await createWorkDir('owapf-export');
    try {
        const archiveEntries = await writeArchiveFiles(jsonData, stagingDir);
        const archiveFilePath = await genNextArchiveFilePath(
            getDownloadPath(),
            toPresentingFlowArchiveFileName(
                presentingFlow.fileSource.name,
                password,
            ),
            toArchiveDotExtension(
                PRESENTING_FLOW_ARCHIVE_DOT_EXTENSION,
                password,
            ),
        );
        // Protecting one means tar writes into the staging dir that is deleted
        // in `finally` anyway, so the plain copy never outlives the call and
        // only the wrapped one reaches Downloads.
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

export async function exportPresentingFlow(presentingFlow: PresentingFlow) {
    // One dialog, always — an empty answer writes exactly the bundle this
    // export has always written; cancelling backs out of the whole thing.
    const password = await askForNewArchivePassword('Export Presenting Flow');
    if (password === null) {
        return null;
    }
    // Protecting a bundle adds a full re-read of it, so the export is no longer
    // instant and says so.
    showProgressBar('Export Presenting Flow');
    try {
        const archiveFilePath = await createPresentingFlowArchive(
            presentingFlow,
            password || null,
        );
        showSimpleToast(
            'Export Presenting Flow',
            `Exported to ${archiveFilePath}`,
        );
        showFileOrDirExplorer(archiveFilePath);
        return archiveFilePath;
    } catch (error: any) {
        handleError(error);
        showSimpleToast(
            'Export Presenting Flow',
            error?.message ?? 'Unable to export the presenting flow',
        );
        return null;
    } finally {
        hideProgressBar('Export Presenting Flow');
    }
}

function validateManifest(jsonData: unknown): ArchiveManifestType {
    const manifest = jsonData as Partial<ArchiveManifestType> | null;
    if (
        manifest === null ||
        typeof manifest !== 'object' ||
        manifest.version !== ARCHIVE_VERSION ||
        typeof manifest.presentingFlow !== 'string'
    ) {
        throw new Error('Invalid presenting flow archive manifest');
    }
    return {
        version: ARCHIVE_VERSION,
        presentingFlow: manifest.presentingFlow,
        files: validateArchiveFileEntries(
            manifest.files,
            'Invalid presenting flow archive file entry',
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
async function importBibleItem(item: PresentingFlowItemType) {
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
    items: PresentingFlowItemType[],
    localFilePathByOriginalPath: Map<string, string>,
) {
    for (const item of items) {
        // A CC bible verse is re-created in the Default bible list exactly as a
        // listed one is — inside this loop, not beside it: imported without it
        // the CC would point at a bible file that does not exist here.
        for (const itemJson of iteratePresentingFlowItemJsons(item)) {
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

export async function importPresentingFlowArchive(archiveFilePath: string) {
    const extractDir = await createWorkDir('owapf-import');
    try {
        // A protected bundle is decrypted into the same work dir this is
        // already unpacking into, so `safeDeleteDir` below carries the plain
        // copy away with everything else.
        const readableArchive = await openArchiveForReading(
            archiveFilePath,
            extractDir,
            IMPORT_TITLE,
        );
        if (readableArchive === null) {
            return null;
        }
        await tarExtract(readableArchive.filePath, extractDir);
        const manifest = validateManifest(
            await readArchiveManifest(
                extractDir,
                'Invalid presenting flow archive manifest',
            ),
        );
        const jsonData = parseJsonSafely(
            await fsReadFile(
                toExtractedArchivePath(extractDir, manifest.presentingFlow),
            ),
            true,
        ) as PresentingFlowType | null;
        if (jsonData === null || !Array.isArray(jsonData.items)) {
            throw new Error('Invalid presenting flow data in the archive');
        }
        // Every folder the import needs is resolved up front — the presenting flows
        // folder included — so a missing one fails before anything has been
        // written rather than after half the bundle has landed.
        const presentingFlowDirPath = DirSource.getDirPathBySettingName(
            dirSourceSettingNames.PRESENTING_FLOW,
        );
        if (!presentingFlowDirPath) {
            throw new Error('No presenting flows folder is selected yet');
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
            PRESENTING_FLOW_ARCHIVE_DOT_EXTENSION,
        );
        const fileSource = FileSource.getInstance(
            pathJoin(presentingFlowDirPath, `${archiveFileName}.owpf`),
        );
        const presentingFlowFilePath = await fileSource.genNextFilePath();
        await fsCreateFile(
            presentingFlowFilePath,
            JSON.stringify(jsonData),
            true,
        );
        FileSource.getInstance(presentingFlowFilePath).fireUpdateEvent();
        return PresentingFlow.getInstance(presentingFlowFilePath);
    } finally {
        await safeDeleteDir(extractDir);
    }
}

const IMPORT_TITLE = 'Import Presenting Flow';

async function runPresentingFlowArchiveImport(archiveFilePath: string) {
    showProgressBar(IMPORT_TITLE);
    try {
        const presentingFlow =
            await importPresentingFlowArchive(archiveFilePath);
        // `null` is the password prompt being cancelled — the operator already
        // knows they backed out, so it gets no toast.
        if (presentingFlow === null) {
            return null;
        }
        showSimpleToast(
            IMPORT_TITLE,
            `Imported ${presentingFlow.fileSource.name}`,
        );
        return presentingFlow;
    } catch (error: any) {
        handleError(error);
        showSimpleToast(
            IMPORT_TITLE,
            error?.message ?? 'Unable to import the presenting flow',
        );
        return null;
    } finally {
        hideProgressBar(IMPORT_TITLE);
    }
}

export async function selectAndImportPresentingFlowArchive() {
    const filePaths = await selectFiles([
        {
            name: 'Open Worship Presenting Flow Archive',
            // `enc` is the password protected shape of the same bundle.
            extensions: ['gz', 'tgz', 'tar', 'enc'],
        },
    ]);
    const archiveFilePath = filePaths[0];
    if (!archiveFilePath) {
        return null;
    }
    return await runPresentingFlowArchiveImport(archiveFilePath);
}

export function checkIsPresentingFlowArchiveFileFullName(fileFullName: string) {
    return checkIsArchiveFileFullName(
        fileFullName,
        PRESENTING_FLOW_ARCHIVE_DOT_EXTENSION,
    );
}

/**
 * Ask for a URL, stream the archive into a temp work dir, then hand it to the
 * same import the file picker and drop paths use. The bundle is deleted as soon
 * as it has been unpacked — it carries every media file the presenting flow uses and
 * can be big, so keeping a second copy around is wasted disk.
 *
 * The imported presenting flow is named after the archive file (see
 * `importPresentingFlowArchive`), so the downloaded copy must keep the name the URL
 * carries — a random temp name would produce a presenting flow called after a UUID.
 */
export async function askAndImportPresentingFlowArchiveFromUrl() {
    const url = await askForURL(
        tran('Import From URL'),
        'Presenting Flow Archive URL:',
    );
    if (url === null) {
        return null;
    }
    const workDirPath = await createWorkDir('owapf-url');
    try {
        const archiveFilePath = pathJoin(
            workDirPath,
            toArchiveFileNameFromUrl(
                url,
                PRESENTING_FLOW_ARCHIVE_DOT_EXTENSION,
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
        return await runPresentingFlowArchiveImport(archiveFilePath);
    } catch (error: any) {
        handleError(error);
        showSimpleToast(
            IMPORT_TITLE,
            error?.message ?? 'Unable to import the presenting flow',
        );
        return null;
    } finally {
        await safeDeleteDir(workDirPath);
    }
}

/**
 * Import an archive dropped onto the presenting flows list. The file is read from
 * where it already sits — a bundle carries every media file the presenting flow uses
 * and can be big, so copying it into the app folders just to unpack it is
 * wasted I/O. `appFilePath` is stamped onto every `File` the electron preload
 * hands over; a drop that somehow carries none is staged in the temp folder
 * instead of being refused.
 */
export async function importDroppedPresentingFlowArchive(
    file: DroppedFileType,
) {
    let tempDirPath: string | null = null;
    try {
        let archiveFilePath =
            typeof file === 'string' ? file : getAppFilePathFromFile(file);
        if (archiveFilePath === null) {
            tempDirPath = await createWorkDir('owapf-dropped');
            archiveFilePath = await fsCopyFilePathToPath(
                file,
                tempDirPath,
                (file as File).name,
            );
        }
        if (archiveFilePath === null) {
            throw new Error(
                'Unable to read the dropped presenting flow archive',
            );
        }
        return await runPresentingFlowArchiveImport(archiveFilePath);
    } catch (error: any) {
        handleError(error);
        showSimpleToast(
            IMPORT_TITLE,
            error?.message ?? 'Unable to import the presenting flow',
        );
        return null;
    } finally {
        if (tempDirPath !== null) {
            await safeDeleteDir(tempDirPath);
        }
    }
}
