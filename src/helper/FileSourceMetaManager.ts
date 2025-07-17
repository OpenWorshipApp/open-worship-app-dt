import ToastEventListener from '../event/ToastEventListener';
import appProvider from '../server/appProvider';
import { checkIsAppFile, fsCheckFileExist } from '../server/fileHelpers';
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

function getColorNoteSetting(filePath: string): string | null {
    const setting = settingManager.getSetting();
    const color = setting[filePath];
    if (isColor(color)) {
        return color;
    }
    return null;
}
function setColorNoteSetting(filePath: string, color: string | null) {
    const setting = settingManager.getSetting();
    const key = filePath;
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
            return getColorNoteSetting(filePath);
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
            setColorNoteSetting(filePath, color);
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
    static unsetColorNote(filePath: string, isSetting = false) {
        if (isSetting) {
            setColorNoteSetting(filePath, null);
            return;
        }
        this.setColorNote(filePath, null);
    }
    static async checkAllColorNotes() {
        const setting = settingManager.getSetting();
        for (const key in setting) {
            try {
                if (await fsCheckFileExist(key)) {
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
