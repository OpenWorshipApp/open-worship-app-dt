import { pathResolve } from '../server/fileHelpers';
import { appLocalStorage } from '../setting/directory-setting/appLocalStorage';
import { getSetting } from './settingHelpers';

/**
 * The folder a directory setting names, resolved; null while no data folder
 * is in use or when the setting is empty. `DirSource.getDirPathBySettingName`
 * is this. It lives apart so a window that loads no `DirSource` -- the help
 * window, naming a study kept in Bible Notes (EC-509) -- can ask it.
 */
export function getDirPathBySettingName(settingName: string) {
    // No data folder, no folders in it. The app's own folder may still
    // name those of a data folder used long ago, and a panel then listed
    // that folder's files with nothing chosen.
    if (appLocalStorage.isOnOwnFolder) {
        return null;
    }
    const dirPath = getSetting(settingName) ?? '';
    if (!dirPath) {
        return null;
    }
    return pathResolve(dirPath);
}
