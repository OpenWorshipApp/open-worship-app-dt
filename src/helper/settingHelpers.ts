import { useState } from 'react';

import appProvider from '../server/appProvider';
import { appLocalStorage } from '../setting/directory-setting/appLocalStorage';

export function setSetting(key: string, value: string | null) {
    // TODO: Change to use SettingManager
    if (value === null) {
        appLocalStorage.setItem(key, '');
        return;
    }
    appLocalStorage.setItem(key, value);
}
export function getSetting(key: string) {
    // TODO: Change to use SettingManager
    return appLocalStorage.getItem(key);
}

export function useStateSettingBoolean(
    settingName: string,
    defaultValue?: boolean,
): [boolean, (b: boolean | ((prev: boolean) => boolean)) => void] {
    const originalSettingName = getSetting(settingName);
    const defaultData =
        originalSettingName === null
            ? !!defaultValue
            : originalSettingName === 'true';
    const [data, setData] = useState(defaultData);
    const setDataSetting = (b: boolean | ((prev: boolean) => boolean)) => {
        if (typeof b === 'function') {
            b = b(data);
        }
        setData(b);
        setSetting(settingName, `${b}`);
    };
    return [data, setDataSetting];
}
export function useStateSettingString<T extends string>(
    settingName: string,
    defaultString: T = '' as T,
): [T, (t: T | ((prev: T) => T)) => void] {
    const defaultData = getSetting(settingName) || defaultString;
    const [data, setData] = useState<T>(defaultData as T);
    const setDataSetting = (text: string | ((prev: T) => T)) => {
        if (typeof text === 'function') {
            text = text(data);
        }
        setData(text as T);
        setSetting(settingName, `${text}`);
    };
    return [data, setDataSetting];
}
export function useStateSettingNumber(
    settingName: string,
    defaultNumber: number,
): [number, (n: number | ((prev: number) => number)) => void] {
    const defaultData = parseInt(getSetting(settingName) ?? '', 10);
    const [data, setData] = useState(
        isNaN(defaultData) ? defaultNumber : defaultData,
    );
    const setDataSetting = (num: number | ((prev: number) => number)) => {
        if (typeof num === 'function') {
            num = num(data);
        }
        setData(num);
        setSetting(settingName, `${num}`);
    };
    return [data, setDataSetting];
}

export function getSettingPrefix() {
    const prefixSetting = appProvider.isPageReader ? 'reader-' : '';
    return prefixSetting;
}
