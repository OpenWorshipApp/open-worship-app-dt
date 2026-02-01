import EventHandler from '../event/EventHandler';
import type { FileMetadataType, MimetypeNameType } from '../server/fileHelpers';
import {
    getFileMetaData,
    getAppMimetype,
    fsListFiles,
    fsCheckDirExist,
    pathResolve,
    fsCheckFileExist,
} from '../server/fileHelpers';
import { unlocking } from '../server/unlockingHelpers';
import { showSimpleToast } from '../toast/toastHelpers';
import { handleError } from './errorHelpers';
import FileSource from './FileSource';
import { getSetting, setSetting } from './settingHelpers';

export type DirSourceEventType = 'reload';

const fileCacheKeys: string[] = [];
const cache = new Map<string, DirSource>();
export default class DirSource extends EventHandler<DirSourceEventType> {
    settingName: string;
    static readonly eventNamePrefix: string = 'dir-source';
    checkExtraFile: ((fName: string) => FileMetadataType | null) | null = null;
    private _isDirPathValid: boolean | null = null;
    filePathsMap: Record<string, string[]> = {};

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
        setSetting(this.settingName, newDirPath);
        this.fireReloadEvent();
    }

    static toCacheKey(settingName: string) {
        const cacheKey = `${settingName}-${getSetting(settingName) ?? ''}`;
        fileCacheKeys.push(cacheKey);
        return cacheKey;
    }

    static getCacheKeyByDirPath(dirPath: string) {
        return (
            fileCacheKeys.find((cacheKey) => {
                return cacheKey.includes(dirPath);
            }) ?? null
        );
    }

    getFileSourceInstance(fileFullName: string) {
        return FileSource.getInstance(this.dirPath, fileFullName);
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

    async getFilePathsQuick(mimetypeName: MimetypeNameType) {
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
                if (fileMetadata === null && this.checkExtraFile) {
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

    async getFilePaths(mimetypeName: MimetypeNameType) {
        if (!this.dirPath) {
            return [];
        }
        return unlocking(
            `getFilePaths-${mimetypeName}-${this.dirPath}`,
            async () => {
                const filePathsInMap = this.filePathsMap[mimetypeName];
                if (filePathsInMap?.length) {
                    return filePathsInMap;
                }
                try {
                    this.filePathsMap[mimetypeName] =
                        await this.getFilePathsQuick(mimetypeName);
                } catch (error) {
                    handleError(error);
                    showSimpleToast(
                        'Getting File List',
                        'Error occurred during listing file',
                    );
                }
                return this.filePathsMap[mimetypeName] ?? null;
            },
        );
    }

    static async getInstance(settingName: string) {
        const cacheKey = this.toCacheKey(settingName);
        if (!cache.has(cacheKey)) {
            const dirSource = new DirSource(settingName);
            await dirSource.init();
            cache.set(cacheKey, dirSource);
        }
        return cache.get(cacheKey) as DirSource;
    }

    static getInstanceByDirPath(dirPath: string) {
        const cacheKey = this.getCacheKeyByDirPath(dirPath);
        if (cacheKey !== null && cache.has(cacheKey)) {
            return cache.get(cacheKey) as DirSource;
        }
        return null;
    }
}
