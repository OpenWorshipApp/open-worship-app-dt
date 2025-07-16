import { showAppConfirm } from '../../popup-widget/popupWidgetHelpers';
import appProvider from '../../server/appProvider';
import {
    fsCheckDirExist,
    fsCreateDir,
    fsExistSync,
    getDesktopPath,
    pathJoin,
} from '../../server/fileHelpers';
import { showSimpleToast } from '../../toast/toastHelpers';
import {
    defaultDataDirNames,
    dirSourceSettingNames,
} from '../../helper/constants';
import DirSource from '../../helper/DirSource';
import { handleError } from '../../helper/errorHelpers';
import { getSetting, setSetting } from '../../helper/settingHelpers';
import { appLocalStorage } from './appLocalStorage';
import FileSource from '../../helper/FileSource';

export function getDefaultDataDir() {
    const desktopPath = getDesktopPath();
    const dirPath = appProvider.pathUtils.join(
        desktopPath,
        'open-worship-data',
    );
    return dirPath;
}

export async function selectPathForChildDir(parentDirPath: string) {
    const isOk = await showAppConfirm(
        'Set according paths',
        `All child directories will be set under "${parentDirPath}"?`,
    );
    if (!isOk) {
        return;
    }
    try {
        for (const [k, v] of Object.entries(defaultDataDirNames)) {
            const settingName = (dirSourceSettingNames as any)[k];
            const dirPath = appProvider.pathUtils.join(parentDirPath, v);
            await fsCreateDir(dirPath);
            const isSuccess = await fsCheckDirExist(dirPath);
            if (isSuccess) {
                setSetting(settingName, dirPath);
            } else {
                await showAppConfirm(
                    'Creating Default Folder',
                    `Fail to create folder "${dirPath}"`,
                );
            }
        }
        appProvider.reload();
    } catch (error: any) {
        if (!error.message.includes('file already exists')) {
            handleError(error);
        }
        showSimpleToast(
            'Creating Default Folder',
            `Fail to create folder "${parentDirPath}"`,
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

export async function selectDefaultDataDirName(
    dirSource: DirSource,
    dirName: string,
) {
    const selectedParentDir =
        await appLocalStorage.getSelectedParentDirectory();
    if (selectedParentDir === null) {
        showSimpleToast(
            '`No Parent Directory Selected`',
            '`There is no parent directory selected`',
        );
        return;
    }
    const dirPath = appProvider.pathUtils.join(selectedParentDir, dirName);
    const isOk = await showAppConfirm(
        '`Select Default Folder',
        `This will select "${dirPath}" (will create if not exist)`,
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
            '`Creating Default Folder',
            `Fail to create folder "${dirPath}"`,
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
        this.initBaseDir = DirSource.dirPathBySettingName(baseDirSettingName);
    }

    get fileFullNameOrFilePath() {
        if (this.intFileSource !== null) {
            if (
                this.initBaseDir !== null &&
                DirSource.checkIsSameDirPath(
                    this.initBaseDir,
                    this.intFileSource.basePath,
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
