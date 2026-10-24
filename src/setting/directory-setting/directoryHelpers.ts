import { showAppConfirm } from '../../popup-widget/popupWidgetHelpers';
import appProvider from '../../server/appProvider';
import {
    checkIsHiddenName,
    ensureDirectory,
    fsCheckDirExist,
    fsCheckFileExist,
    fsCreateDir,
    fsExistSync,
    fsGetFileSize,
    fsListDirectories,
    fsListDirents,
    fsReadFile,
    fsWriteFile,
    getDefaultDataDirPath,
    getFileDotExtension,
    pathJoin,
    pathResolve,
    repairDataDirLinksInText,
    toPathCompareKey,
} from '../../server/fileHelpers';
import { showSimpleToast } from '../../toast/toastHelpers';
import { tran } from '../../lang/langHelpers';
import {
    appManagedDataDirNames,
    defaultDataDirNames,
    dirSourceSettingNames,
} from '../../helper/constants';
import DirSource from '../../helper/DirSource';
import { handleError } from '../../helper/errorHelpers';
import { getSetting, setSetting } from '../../helper/settingHelpers';
import {
    appLocalStorage,
    LOCAL_STORAGE_FOLDER_NAME,
    TMP_FILES_FOLDER_NAME,
} from './appLocalStorage';
import FileSource from '../../helper/FileSource';
import { escapeHtmlText } from '../../helper/sanitizeHelpers';

export function getDefaultDataDir() {
    return getDefaultDataDirPath();
}

export async function removePathForChildDir() {
    for (const [k, _v] of Object.entries(defaultDataDirNames)) {
        const settingName = (dirSourceSettingNames as any)[k];
        setSetting(settingName, '');
    }
    appProvider.reload();
}

/**
 * Whether a folder has been a data folder before -- on this computer or the
 * one a stick came from -- and so already holds its own settings, including
 * where its documents, videos and the rest are.
 */
export function checkIsUsedDataDir(dirPath: string) {
    return fsCheckDirExist(pathJoin(dirPath, LOCAL_STORAGE_FOLDER_NAME));
}

// The parent folders this window has asked about already. Choosing a new
// folder asks, and the Path Settings page that renders on it next checks
// again and found no child folder either -- so a No had to be given twice
// (React's second mount in development made it three).
const childDirAskedKeySet = new Set<string>();

function toChildDirAskedKey(parentDirPath: string) {
    return toPathCompareKey(pathResolve(parentDirPath));
}

export async function selectPathForChildDir(parentDirPath: string) {
    childDirAskedKeySet.add(toChildDirAskedKey(parentDirPath));
    const isOk = await showAppConfirm(
        tran('Set according paths'),
        `${tran('Create and use the standard folders (Documents, Videos, Images and the rest) inside')} ` +
            `"${escapeHtmlText(parentDirPath)}"?`,
        {
            cancelButtonLabel: 'No',
            confirmButtonLabel: 'Yes',
        },
    );
    if (!isOk) {
        return;
    }
    try {
        for (const [k, v] of Object.entries(defaultDataDirNames)) {
            const settingName = (dirSourceSettingNames as any)[k];
            const dirPath = pathJoin(parentDirPath, v);
            await fsCreateDir(dirPath);
            const isSuccess = await fsCheckDirExist(dirPath);
            if (isSuccess) {
                setSetting(settingName, dirPath);
            } else {
                await showAppConfirm(
                    tran('Creating Default Folder'),
                    `${tran('Fail to create folder')} "${dirPath}"`,
                );
            }
        }
        appProvider.reload();
    } catch (error: any) {
        if (!error.message.includes('file already exists')) {
            handleError(error);
        }
        showSimpleToast(
            tran('Creating Default Folder'),
            `${tran('Fail to create folder')} "${parentDirPath}"`,
        );
        return;
    }
}

export async function checkShouldSelectChildDir() {
    const validList = await Promise.all(
        Object.values(dirSourceSettingNames).map((settingName) => {
            return fsCheckDirExist(getSetting(settingName) ?? 'none');
        }),
    );
    const isSomeValid = validList.some((isValid) => {
        return isValid;
    });
    return !isSomeValid;
}

/**
 * The question about the standard folders, when the data folder has none of
 * them set -- once per folder in this window, whatever the answer was. The
 * key is taken before anything is awaited, so two calls racing (a choice and
 * the page it reloads into) ask one question.
 */
export async function selectPathForChildDirIfNeeded(parentDirPath: string) {
    const key = toChildDirAskedKey(parentDirPath);
    if (childDirAskedKeySet.has(key)) {
        return;
    }
    childDirAskedKeySet.add(key);
    if (await checkShouldSelectChildDir()) {
        await selectPathForChildDir(parentDirPath);
    }
}

export async function selectDefaultDataDirName(
    dirSource: DirSource,
    dirName: string,
) {
    const selectedParentDir =
        await appLocalStorage.getSelectedParentDirectory();
    if (selectedParentDir === null) {
        showSimpleToast(
            tran('No Parent Directory Selected'),
            tran('There is no parent directory selected'),
        );
        return;
    }
    const dirPath = pathJoin(selectedParentDir, dirName);
    const isOk = await showAppConfirm(
        tran('Select Default Folder'),
        `${tran('This will select')} "${dirPath}" ` +
            `(${tran('will create if not exist')})`,
    );
    if (!isOk) {
        return;
    }
    try {
        await fsCreateDir(dirPath);
    } catch (error: any) {
        if (!error.message.includes('file already exists')) {
            handleError(error);
        }
        showSimpleToast(
            tran('Creating Default Folder'),
            `${tran('Fail to create folder')} "${dirPath}"`,
        );
        return;
    }
    dirSource.dirPath = dirPath;
}

export class BaseDirFileSource {
    initBaseDir: string | null;
    initFileFullName: string | null = null;
    intFileSource: FileSource | null = null;

    constructor(baseDirSettingName: string, fileFullNameOrFilePath: string) {
        try {
            if (fsExistSync(fileFullNameOrFilePath)) {
                this.intFileSource = FileSource.getInstance(
                    fileFullNameOrFilePath,
                );
            } else {
                this.initFileFullName = fileFullNameOrFilePath;
            }
        } catch (_error) {}
        this.initBaseDir =
            DirSource.getDirPathBySettingName(baseDirSettingName);
    }

    get fileFullNameOrFilePath() {
        if (this.intFileSource !== null) {
            if (
                this.initBaseDir !== null &&
                DirSource.checkIsSameDirPath(
                    this.initBaseDir,
                    this.intFileSource.baseDirPath,
                )
            ) {
                return this.intFileSource.fullName;
            }
            return this.intFileSource.filePath;
        }
        return this.initFileFullName;
    }

    get fileSource() {
        if (this.initFileFullName !== null && this.initBaseDir !== null) {
            return FileSource.getInstance(
                pathJoin(this.initBaseDir, this.initFileFullName),
            );
        }
        if (this.intFileSource !== null) {
            return this.intFileSource;
        }
        return null;
    }
}

// The app's own text files -- the only ones a link to a picture, video or
// song is kept in. Never a video or an image: those are never read here.
const LINK_REPAIR_DOT_EXTENSIONS = new Set([
    '.ows',
    '.preview',
    '.owl',
    '.owpf',
    '.owb',
    '.own',
    '.json',
]);
// Folders the app downloads or rebuilds by itself, plus the undo backups,
// which must keep what a file said when it was backed up. Built on the press,
// not at load, like everything else only the repair needs.
function genLinkRepairSkippedDirNames() {
    return new Set<string>([
        appManagedDataDirNames.EXTRA_BIN,
        appManagedDataDirNames.BIBLE_DATA,
        appManagedDataDirNames.LOOKUP_DATA,
        appManagedDataDirNames.AGENT_BACKUP,
        TMP_FILES_FOLDER_NAME,
        'temp-xml',
    ]);
}
const LINK_REPAIR_MAX_FILE_BYTES = 5 * 1024 * 1024;

function checkIsLinkRepairFile(fileFullName: string, isSettingsDir: boolean) {
    // A setting's name is its key and may hold a dot; an editing history's
    // steps (`1`, `2-head`) have no extension at all.
    if (isSettingsDir || !fileFullName.includes('.')) {
        return true;
    }
    return LINK_REPAIR_DOT_EXTENSIONS.has(
        getFileDotExtension(fileFullName).toLowerCase(),
    );
}

/**
 * Every one of the app's own text files in a data folder -- documents, songs,
 * run sheets, notes, settings and editing histories -- handed to `handler`
 * with its path, one at a time. Folders the app downloads or rebuilds by
 * itself, hidden names and files over 5 MB are left out. An unreadable folder
 * or a failing handler skips that one, not the walk.
 */
export async function forEachDataDirTextFile(
    dataDirPath: string,
    handler: (filePath: string) => Promise<void>,
) {
    const settingsDirPath = pathJoin(dataDirPath, LOCAL_STORAGE_FOLDER_NAME);
    const skippedDirNames = genLinkRepairSkippedDirNames();
    const queue = [dataDirPath];
    while (queue.length > 0) {
        const dirPath = queue.shift() as string;
        const direntList = await fsListDirents(dirPath).catch((error) => {
            handleError(error);
            return [];
        });
        for (const { name, isFile, isDirectory } of direntList) {
            const entryPath = pathJoin(dirPath, name);
            if (checkIsHiddenName(name)) {
                continue;
            }
            if (isDirectory) {
                if (dirPath !== dataDirPath || !skippedDirNames.has(name)) {
                    queue.push(entryPath);
                }
                continue;
            }
            if (
                !isFile ||
                !checkIsLinkRepairFile(name, dirPath === settingsDirPath)
            ) {
                continue;
            }
            try {
                if (
                    (await fsGetFileSize(entryPath)) >
                    LINK_REPAIR_MAX_FILE_BYTES
                ) {
                    continue;
                }
                await handler(entryPath);
            } catch (error) {
                handleError(error);
            }
        }
    }
}

/**
 * Point every link in the data folder that names an OLD location of it --
 * saved before `$DATA_DIR_PATH` existed, or while the folder lived on another
 * computer -- at the folder where it is now (`repairDataDirLinksInText`). A
 * link that still points at something is never touched. On the press of
 * **Repair Links** only: it reads every document, song and setting once, which
 * is not a cost to pay on an ordinary start. Null with no folder chosen.
 */
export async function repairDataDirLinks() {
    const dataDirPath = await appLocalStorage.getSelectedParentDirectory();
    if (dataDirPath === null) {
        return null;
    }
    const childNames = await fsListDirectories(dataDirPath);
    const isThereByPath = new Map<string, Promise<boolean>>();
    const checkIsThere = (filePath: string) => {
        let isThere = isThereByPath.get(filePath);
        if (isThere === undefined) {
            isThere = Promise.all([
                fsCheckFileExist(filePath),
                fsCheckDirExist(filePath),
            ])
                .then(([isFile, isDir]) => {
                    return isFile || isDir;
                })
                // Unreadable is not gone: such a link is left alone.
                .catch(() => {
                    return true;
                });
            isThereByPath.set(filePath, isThere);
        }
        return isThere;
    };
    const result = { linkCount: 0, fileCount: 0 };
    await forEachDataDirTextFile(dataDirPath, async (filePath) => {
        const repaired = await repairDataDirLinksInText(
            await fsReadFile(filePath),
            dataDirPath,
            childNames,
            checkIsThere,
        );
        if (repaired.count === 0) {
            return;
        }
        await fsWriteFile(filePath, repaired.text);
        FileSource.forgetCachedData(filePath);
        result.linkCount += repaired.count;
        result.fileCount += 1;
    });
    return result;
}

export async function ensureDataDirectory(dataDirName: string) {
    const parentDir = await appLocalStorage.getSelectedParentDirectory();
    if (parentDir === null) {
        return null;
    }
    const dataDir = pathJoin(parentDir, dataDirName);
    await ensureDirectory(dataDir);
    return dataDir;
}
