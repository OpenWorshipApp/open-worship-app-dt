import FileSource from '../helper/FileSource';
import SettingManager from '../helper/SettingManager';

const fadingAtTheEndSettingManager = new SettingManager<{
    [key: string]: boolean;
}>({
    settingName: 'video-fading-at-the-end',
    defaultValue: {},
    isErrorToDefault: true,
    validate: (jsonString) => {
        try {
            return JSON.parse(jsonString) instanceof Object;
        } catch (_error) {
            return false;
        }
    },
    serialize: (json) => JSON.stringify(json),
    deserialize: (jsonString) => JSON.parse(jsonString),
});

export function getIsFadingAtTheEndSetting(src: string) {
    const settingData = fadingAtTheEndSettingManager.getSetting();
    if (settingData[src] !== undefined) {
        return settingData[src];
    }
    const fileSource = FileSource.getInstance(src);
    if (fileSource.name.includes('.loop')) {
        return false;
    }
    return true;
}

export const methodMapIsFadingAtTheEnd: {
    [key: string]: (value: boolean) => void;
} = {};
export function setIsFadingAtTheEndSetting(src: string, value: boolean) {
    methodMapIsFadingAtTheEnd[src]?.(value);
    const settingData = fadingAtTheEndSettingManager.getSetting();
    settingData[src] = value;
    fadingAtTheEndSettingManager.setSetting(settingData);
}
