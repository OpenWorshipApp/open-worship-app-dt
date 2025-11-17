import { useState, useCallback, SetStateAction, Dispatch } from 'react';

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
): [boolean, Dispatch<SetStateAction<boolean>>] {
    const originalSettingName = getSetting(settingName);
    const defaultData =
        originalSettingName === null
            ? !!defaultValue
            : originalSettingName === 'true';
    const [data, setData] = useState(defaultData);
    const setDataSetting = useCallback(
        (b: boolean | ((prev: boolean) => boolean)) => {
            const newValue = typeof b === 'function' ? b(data) : b;
            setData(newValue);
            setSetting(settingName, `${newValue}`);
        },
        [data, settingName],
    );
    return [data, setDataSetting];
}
export function useStateSettingString<T extends string>(
    settingName: string,
    defaultString: T = '' as T,
): [T, Dispatch<SetStateAction<T>>] {
    const defaultData = getSetting(settingName) || defaultString;
    const [data, setData] = useState<T>(defaultData as T);
    const setDataSetting = useCallback(
        (text: string | ((prev: T) => T)) => {
            const newValue = typeof text === 'function' ? text(data) : text;
            setData(newValue as T);
            setSetting(settingName, `${newValue}`);
        },
        [data, settingName],
    );
    return [data, setDataSetting];
}
export function useStateSettingNumber(
    settingName: string,
    defaultNumber: number,
): [number, Dispatch<SetStateAction<number>>] {
    const defaultData = Number.parseInt(getSetting(settingName) ?? '', 10);
    const [data, setData] = useState(
        Number.isNaN(defaultData) ? defaultNumber : defaultData,
    );
    const setDataSetting = useCallback(
        (num: number | ((prev: number) => number)) => {
            const newValue = typeof num === 'function' ? num(data) : num;
            setData(newValue);
            setSetting(settingName, `${newValue}`);
        },
        [data, settingName],
    );
    return [data, setDataSetting];
}

export function getSettingPrefix() {
    const prefixSetting = appProvider.isPageReader ? 'reader-' : '';
    return prefixSetting;
}
