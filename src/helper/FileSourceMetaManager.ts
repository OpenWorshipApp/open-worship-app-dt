import ToastEventListener from '../event/ToastEventListener';
import appProvider from '../server/appProvider';
import {
    checkIsAppFile,
    fsCheckFileExist,
    KEY_SEPARATOR,
} from '../server/fileHelpers';
import { handleError } from './errorHelpers';
import FileSource from './FileSource';
import { isColor } from './helpers';
import SettingManager from './SettingManager';

async function readJsonData(filePath: string) {
    const fileSource = FileSource.getInstance(filePath);
    const json = await fileSource.readFileJsonData();
    if (json === null) {
        appProvider.appUtils.handleError(
            new Error(`Unable to read data from ${filePath}}`),
        );
        ToastEventListener.showSimpleToast({
            title: 'Color Note',
            message: 'Unable to read file',
        });
    }
    return json;
}

const settingManager = new SettingManager<{ [key: string]: string }>({
    settingName: 'itemSourcesMeta',
    defaultValue: {},
    isErrorToDefault: true,
    validate: (jsonString) => {
        try {
            const json = JSON.parse(jsonString);
            return json instanceof Object;
        } catch (error) {
            handleError(error);
        }
        return false;
    },
    serialize: (json) => JSON.stringify(json),
    deserialize: (jsonString) => JSON.parse(jsonString),
});

function toKey(filePath: string, id: string | number | null) {
    let key = filePath;
    if (id !== null) {
        key += KEY_SEPARATOR + id;
    }
    return key;
}
export function getColorNoteFilePathSetting(
    filePath: string,
    id: string | number | null,
): string | null {
    const setting = settingManager.getSetting();
    const key = toKey(filePath, id);
    const color = setting[key];
    if (isColor(color)) {
        return color;
    }
    return null;
}
export function setColorNoteFilePathSetting(
    filePath: string,
    id: string | number | null,
    color: string | null,
) {
    const setting = settingManager.getSetting();
    const key = toKey(filePath, id);
    if (color === null) {
        delete setting[key];
    } else if (isColor(color)) {
        setting[key] = color;
    }
    settingManager.setSetting(setting);
}

export default class FileSourceMetaManager {
    static async getColorNote(filePath: string) {
        if ((await fsCheckFileExist(filePath)) === false) {
            return null;
        }
        const fileSource = FileSource.getInstance(filePath);
        const isAppFile = checkIsAppFile(fileSource.fullName);
        if (!isAppFile) {
            return getColorNoteFilePathSetting(filePath, null);
        }
        const json = await readJsonData(filePath);
        if (json === null) {
            return;
        }
        const color = json.metadata?.colorNote;
        if (isColor(color)) {
            return color;
        }
        return null;
    }
    static async setColorNote(filePath: string, color: string | null) {
        if ((await fsCheckFileExist(filePath)) === false) {
            return null;
        }
        const fileSource = FileSource.getInstance(filePath);
        const isAppFile = checkIsAppFile(fileSource.fullName);
        if (!isAppFile) {
            setColorNoteFilePathSetting(filePath, null, color);
            return;
        }
        const json = await readJsonData(filePath);
        if (json === null) {
            return;
        }
        json.metadata = json.metadata ?? {};
        json.metadata.colorNote = color;
        return fileSource.writeFileData(JSON.stringify(json));
    }
    static async checkAllColorNotes() {
        const setting = settingManager.getSetting();
        for (const key in setting) {
            let filePath = key;
            if (key.includes(KEY_SEPARATOR)) {
                filePath = key.split(KEY_SEPARATOR)[0];
            }
            try {
                if (!filePath || (await fsCheckFileExist(filePath))) {
                    continue;
                }
            } catch (error) {
                handleError(error);
            }
            delete setting[key];
        }
        settingManager.setSetting(setting);
    }
}
