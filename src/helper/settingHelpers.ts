import type { SetStateAction, Dispatch } from 'react';
import { useState, useCallback } from 'react';

import appProvider from '../server/appProvider';
import { appLocalStorage } from '../setting/directory-setting/appLocalStorage';
import { pathJoin, fsCheckFileExist } from '../server/fileHelpers';
import { useAppEffectAsync } from './appHooks';
import { useAppCurrentRef } from './appHooks';

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
export function getSettingForce(key: string) {
    // TODO: Change to use SettingManager
    return appLocalStorage.getItemForce(key);
}

function useWatchSetting(settingName: string, callback: () => void) {
    useAppEffectAsync(async () => {
        const settingFile = pathJoin(
            appLocalStorage.localStorageDir,
            settingName,
        );
        if (!(await fsCheckFileExist(settingFile))) {
            setSetting(settingName, '');
        }
        const abortController = new AbortController();
        appProvider.fileUtils.watch(
            settingFile,
            {
                signal: abortController.signal,
            },
            async (eventType: string, ..._args: any[]) => {
                if (eventType !== 'change') {
                    return;
                }
                appLocalStorage.removeItemCache(settingName);
                callback();
            },
        );
        return () => {
            abortController.abort();
        };
    }, []);
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
    const dataRef = useAppCurrentRef(data);
    const settingNameRef = useAppCurrentRef(settingName);
    const setDataSetting = useCallback(
        (b: boolean | ((prev: boolean) => boolean)) => {
            const newValue = typeof b === 'function' ? b(dataRef.current) : b;
            setData(newValue);
            setSetting(settingNameRef.current, `${newValue}`);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    return [data, setDataSetting];
}
export function useStateSettingString<T extends string>(
    settingName: string,
    defaultString: T = '' as T,
): [T, (text: string | ((prev: T) => T), isSkipSetSetting?: boolean) => void] {
    const defaultData = getSetting(settingName) || defaultString;
    const [data, setData] = useState<T>(defaultData as T);
    const dataRef = useAppCurrentRef(data);
    const settingNameRef = useAppCurrentRef(settingName);
    const setDataSetting = useCallback(
        (text: string | ((prev: T) => T), isSkipSetSetting = false) => {
            const newValue =
                typeof text === 'function' ? text(dataRef.current) : text;
            setData(newValue as T);
            if (!isSkipSetSetting) {
                setSetting(settingNameRef.current, `${newValue}`);
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    return [data, setDataSetting];
}
export function useWatchStateSettingString<T extends string>(
    settingName: string,
    defaultString: T = '' as T,
): [T, Dispatch<SetStateAction<T>>] {
    const [data, setData] = useStateSettingString(settingName, defaultString);
    useWatchSetting(settingName, () => {
        const newValue = getSetting(settingName) || defaultString;
        setData(newValue, true);
    });
    return [data, setData];
}
export function useStateSettingNumber(
    settingName: string,
    defaultNumber: number | (() => number),
): [number, Dispatch<SetStateAction<number>>] {
    let defaultData = Number.parseInt(getSetting(settingName) ?? '', 10);
    if (Number.isNaN(defaultData)) {
        const resolvedDefault =
            typeof defaultNumber === 'function'
                ? defaultNumber()
                : defaultNumber;
        defaultData = resolvedDefault;
    }
    const [data, setData] = useState(defaultData);
    const dataRef = useAppCurrentRef(data);
    const settingNameRef = useAppCurrentRef(settingName);
    const setDataSetting = useCallback(
        (num: number | ((prev: number) => number)) => {
            const newValue =
                typeof num === 'function' ? num(dataRef.current) : num;
            setData(newValue);
            setSetting(settingNameRef.current, `${newValue}`);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    return [data, setDataSetting];
}

export function getSettingPrefix() {
    const prefixSetting = appProvider.isPageReader ? 'reader-' : '';
    return prefixSetting;
}
