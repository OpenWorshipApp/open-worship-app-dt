import FileSource from '../helper/FileSource';
import { getSetting, setSetting } from '../helper/settingHelpers';

const FADING_AT_THE_END_SETTING_NAME = 'video-fading-at-the-end';
function getIsFadingAtTheEndSettingData() {
    const setting = getSetting(FADING_AT_THE_END_SETTING_NAME);
    try {
        const settingData = JSON.parse(setting ?? '{}');
        return settingData;
    } catch (_error) {}
    return {};
}

export function getIsFadingAtTheEndSetting(src: string) {
    const settingData = getIsFadingAtTheEndSettingData();
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
    const settingData = getIsFadingAtTheEndSettingData();
    settingData[src] = value;
    const settingString = JSON.stringify(settingData);
    setSetting(FADING_AT_THE_END_SETTING_NAME, settingString);
}
