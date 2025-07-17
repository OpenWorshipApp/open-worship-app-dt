import DirSource from '../helper/DirSource';
import { getSetting, setSetting } from '../helper/settingHelpers';
import { fsCheckDirExist, fsCheckFileExist } from '../server/fileHelpers';
import { BaseDirFileSource } from '../setting/directory-setting/directoryHelpers';

export async function checkSelectedFilePathExist(
    settingName: string,
    baseDirSettingName: string,
    filePath: string,
) {
    if (!filePath || !(await fsCheckFileExist(filePath))) {
        const baseDir = DirSource.dirPathBySettingName(baseDirSettingName);
        if (baseDir == null || !(await fsCheckDirExist(baseDir))) {
            setSelectedFilePath(settingName, baseDirSettingName, null);
        }
        return false;
    }
    return true;
}

export async function getSelectedFilePath(
    settingName: string,
    baseDirSettingName: string,
) {
    let selectedFilePath = getSetting(settingName) ?? '';
    if (selectedFilePath) {
        const baseDirFileSource = new BaseDirFileSource(
            baseDirSettingName,
            selectedFilePath,
        );
        selectedFilePath =
            baseDirFileSource.fileSource?.filePath ?? selectedFilePath;
    }
    const isValid = await checkSelectedFilePathExist(
        settingName,
        baseDirSettingName,
        selectedFilePath,
    );
    if (!isValid) {
        return null;
    }
    return selectedFilePath;
}

export function setSelectedFilePath(
    settingName: string,
    baseDirSettingName: string,
    filePath: string | null,
) {
    if (filePath !== null) {
        const baseDirFileSource = new BaseDirFileSource(
            baseDirSettingName,
            filePath,
        );
        filePath = baseDirFileSource.fileFullNameOrFilePath;
    }
    setSetting(settingName, filePath ?? '');
}
