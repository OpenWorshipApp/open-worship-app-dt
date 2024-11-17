import ToastEventListener from '../event/ToastEventListener';
import appProvider from '../server/appProvider';
import {
    checkIsAppFile, fsCheckFileExist,
} from '../server/fileHelper';
import { handleError } from './errorHelpers';
import FileSource from './FileSource';
import { isColor } from './helpers';
import { SettingManager } from './settingHelper';


async function readJsonData(filePath: string) {
    const fileSource = FileSource.getInstance(filePath);
    const json = await fileSource.readFileToJsonData();
    if (json === null) {
        appProvider.appUtils.handleError(
            new Error(`Unable to read file from ${filePath}}`)
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

export default class FileSourceMetaManager {
    private static getColorNoteSetting(filePath: string): string | null {
        const setting = settingManager.getSetting();
        const color = setting[filePath];
        if (isColor(color)) {
            return color;
        }
        return null;
    }
    private static setColorNoteSetting(
        filePath: string, color: string | null,
    ) {
        const setting = settingManager.getSetting();
        const key = filePath;
        if (color === null) {
            delete setting[key];
        } else if (isColor(color)) {
            setting[key] = color;
        }
        settingManager.setSetting(setting);
    }
    static async getColorNote(filePath: string) {
        const fileSource = FileSource.getInstance(filePath);
        const isAppFile = checkIsAppFile(fileSource.fileName);
        if (!isAppFile) {
            return this.getColorNoteSetting(filePath);
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
    static async setColorNote(
        filePath: string, color: string | null,
    ) {
        const fileSource = FileSource.getInstance(filePath);
        const isAppFile = checkIsAppFile(fileSource.fileName);
        if (!isAppFile) {
            this.setColorNoteSetting(filePath, color);
            return;
        }
        const json = await readJsonData(filePath);
        if (json === null) {
            return;
        }
        json.metadata = json.metadata || {};
        json.metadata.colorNote = color;
        return fileSource.saveData(JSON.stringify(json));
    }
    static unsetColorNote(filePath: string, isSetting = false) {
        if (isSetting) {
            this.setColorNoteSetting(filePath, null);
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
