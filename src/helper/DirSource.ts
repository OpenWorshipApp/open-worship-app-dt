import EventHandler from '../event/EventHandler';
import { HISTORY_DIR_NAME_SUFFIX } from '../editing-manager/editingHistoryPathHelpers';
import { tran } from '../lang/langHelpers';
import type { FileMetadataType, MimetypeNameType } from '../server/fileHelpers';
import {
    getFileMetaData,
    getAppMimetype,
    fsListFiles,
    fsCheckDirExist,
    pathResolve,
    fsCheckFileExist,
    pathJoin,
} from '../server/fileHelpers';
import { unlocking } from '../server/unlockingHelpers';
import { showSimpleToast } from '../toast/toastHelpers';
import { handleError } from './errorHelpers';
import FileSource from './FileSource';
import { getSetting, setSetting } from './settingHelpers';
import { type OptionalPromise } from './typeHelpers';

export type DirSourceEventType = 'refresh' | 'reload' | 'file-update';

/**
 * The suffixes that make a path a SIDECAR of another file rather than a file of
 * its own — a change inside one is a change to the file it belongs to.
 */
const fileExtraSuffixes = [HISTORY_DIR_NAME_SUFFIX];

const cache = new Map<string, DirSource>();
const initPromises = new Map<string, Promise<void>>();
export default class DirSource extends EventHandler<DirSourceEventType> {
    settingName: string;
    static readonly eventNamePrefix: string = 'dir-source';
    checkExtraFile: ((fName: string) => FileMetadataType | null) | null = null;
    private _isDirPathValid: boolean | null = null;
    filePathsMap: Record<string, string[]> = {};
    setDirPath: (newFilePath: string) => OptionalPromise<void> = () => {};

    constructor(settingName: string) {
        super();
        if (!settingName) {
            throw new Error('Invalid setting name');
        }
        this.settingName = settingName;
    }

    async init() {
        if (!this.dirPath) {
            return;
        }
        const isDirectory =
            !!this.dirPath && (await fsCheckDirExist(this.dirPath));
        this._isDirPathValid = isDirectory;
    }

    get isDirPathValid() {
        return this.dirPath && this._isDirPathValid;
    }

    static getDirPathBySettingName(settingName: string) {
        const dirPath = getSetting(settingName) ?? '';
        if (!dirPath) {
            return null;
        }
        return pathResolve(dirPath);
    }

    get dirPath() {
        return DirSource.getDirPathBySettingName(this.settingName) ?? '';
    }

    set dirPath(newDirPath: string) {
        this.setDirPath(newDirPath);
        setSetting(this.settingName, newDirPath);
        this.fireReloadEvent();
    }

    static toCacheKey(settingName: string) {
        return `${settingName}-${getSetting(settingName) ?? ''}`;
    }

    getFileSourceInstance(fileFullName: string) {
        return FileSource.getInstance(this.dirPath, fileFullName);
    }

    fireRefreshEvent() {
        this.filePathsMap = {};
        this.addPropEvent('refresh');
    }

    fireReloadEvent() {
        this.addPropEvent('reload');
    }

    fireReloadFileEvent(fileFullName: string) {
        if (!this.dirPath) {
            return;
        }
        const fileSource = this.getFileSourceInstance(fileFullName);
        fileSource.fireUpdateEvent();
    }

    async genRandomFilePath(dotExtension: string) {
        if (!this.dirPath) {
            return null;
        }
        let randomFileName = `file-${Date.now()}${dotExtension}`;
        while (
            await fsCheckFileExist(pathResolve(this.dirPath, randomFileName))
        ) {
            randomFileName = `file-${Date.now()}${dotExtension}`;
        }
        return pathResolve(pathResolve(this.dirPath), randomFileName);
    }

    static checkIsSameDirPath(dirPath1: string, dirPath: string) {
        const resolvedDirPath = pathResolve(dirPath1);
        const targetResolvedDirPath = pathResolve(dirPath);
        return resolvedDirPath === targetResolvedDirPath;
    }

    checkIsSameDirPath(dirPath: string) {
        if (!this.dirPath) {
            return false;
        }
        return DirSource.checkIsSameDirPath(this.dirPath, dirPath);
    }

    async getAllFileFullNames() {
        const files = await fsListFiles(this.dirPath);
        return files;
    }

    async getFilePathsQuick(
        mimetypeName: MimetypeNameType,
        isNoExtraFileCheck = false,
    ) {
        const mimetypeList = getAppMimetype(mimetypeName);
        const fileFullNames = await this.getAllFileFullNames();
        const matchedFileFullNames = fileFullNames
            .filter((fileFullName) => {
                // MacOS creates hidden files that start with '._'
                return !fileFullName.startsWith('._');
            })
            .map((fileFullName) => {
                const fileMetadata = getFileMetaData(
                    fileFullName,
                    mimetypeList,
                );
                if (
                    fileMetadata === null &&
                    this.checkExtraFile &&
                    !isNoExtraFileCheck
                ) {
                    return this.checkExtraFile(fileFullName);
                }
                return fileMetadata;
            })
            .filter((fileMetadata) => {
                return fileMetadata !== null;
            });
        const filePaths = matchedFileFullNames.map((fileMetadata) => {
            const fileSource = this.getFileSourceInstance(
                fileMetadata.fileFullName,
            );
            return fileSource.filePath;
        });
        return filePaths;
    }

    async getFilePaths(mimetypeName: MimetypeNameType, isForce = false) {
        if (!this.dirPath || (await fsCheckDirExist(this.dirPath)) === false) {
            return [];
        }
        const getFilePaths = async () => {
            const filePathsInMap = this.filePathsMap[mimetypeName];
            if (filePathsInMap?.length && !isForce) {
                return filePathsInMap;
            }
            try {
                const newFilePaths = await this.getFilePathsQuick(mimetypeName);
                this.filePathsMap[mimetypeName] = newFilePaths;
            } catch (error) {
                handleError(error);
                showSimpleToast(
                    tran('Getting File List'),
                    tran('Error occurred during listing file'),
                );
            }
            const filePaths = this.filePathsMap[mimetypeName];
            if (filePaths === undefined) {
                return null;
            }
            return filePaths;
        };
        const result = await unlocking(
            `get-file-paths-${mimetypeName}-${this.dirPath}`,
            getFilePaths,
        );
        return result;
    }

    static async getInstance(settingName: string) {
        const cacheKey = this.toCacheKey(settingName);
        let dirSource = cache.get(cacheKey);
        if (dirSource === undefined) {
            // cache before awaiting init — the old check-then-set spanned the
            // await, so concurrent callers each built their own instance and
            // the losers' event listeners never received any events
            dirSource = new DirSource(settingName);
            cache.set(cacheKey, dirSource);
            const initPromise = dirSource.init().finally(() => {
                initPromises.delete(cacheKey);
            });
            initPromises.set(cacheKey, initPromise);
        }
        const pendingInit = initPromises.get(cacheKey);
        if (pendingInit !== undefined) {
            await pendingInit;
        }
        return dirSource;
    }

    static getInstanceByDirPath(dirPath: string) {
        // resolved-path equality — substring matching returned the wrong
        // DirSource when one directory path was a substring of another
        for (const dirSource of cache.values()) {
            if (dirSource.checkIsSameDirPath(dirPath)) {
                return dirSource;
            }
        }
        return null;
    }

    /**
     * Something under this directory changed on disk.
     *
     * The changed path is told first, always. Then — and ONLY when the path is a
     * SIDECAR of another file (`fileExtraSuffixes`, i.e. an editing-history
     * folder) — the file it belongs to is told as well: a revision written into
     * `song.ows.histories` IS a change to `song.ows`, and nothing else would ever
     * say so.
     *
     * The suffix has to be PRESENT for that second half to run. `split` on a
     * suffix that is not there answers with the whole path, so testing every
     * change against the filesystem would spend one `fsCheckFileExist` and one
     * duplicate dispatch on every ordinary file change in the app — the common
     * case by far, and the one this must stay free for.
     */
    // TODO: support other events: 'rename', 'unlink', 'add'
    async alertFileChanging(fileFullName: string) {
        const dirPath = this.dirPath;
        if (!dirPath) {
            return;
        }
        const filePath = pathJoin(dirPath, fileFullName);
        FileSource.getInstance(filePath).fireUpdateEvent();
        const sidecarSuffix = fileExtraSuffixes.find((suffix) => {
            return filePath.includes(suffix);
        });
        if (sidecarSuffix === undefined) {
            return;
        }
        const originalFilePath = filePath.split(sidecarSuffix)[0];
        if (await fsCheckFileExist(originalFilePath)) {
            FileSource.getInstance(originalFilePath).fireUpdateEvent();
        }
    }
}
