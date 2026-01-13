import { useState, useCallback, ChangeEvent } from 'react';

import { tran } from '../lang/langHelpers';
import { useAppEffect } from '../helper/debuggerHelpers';
import {
    applyDarkModeToApp,
    darkModeHook,
    getThemeSourceSetting,
    setThemeSourceSetting,
    ThemeOptionType,
} from '../others/initHelpers';

export default function SettingGeneralThemeComp() {
    const [themeSource, setThemeSource] = useState<ThemeOptionType>(
        getThemeSourceSetting(),
    );

    const setMode1 = useCallback((newThemeSource: ThemeOptionType) => {
        setThemeSource(newThemeSource);
        setThemeSourceSetting(newThemeSource);
        applyDarkModeToApp();
    }, []);

    const handleChange = useCallback(
        (event: ChangeEvent<HTMLSelectElement>) => {
            const value = event.target.value;
            setMode1(value as ThemeOptionType);
        },
        [setMode1],
    );

    useAppEffect(() => {
        darkModeHook.check = () => {
            const themeSourceSetting = getThemeSourceSetting();
            setThemeSource(themeSourceSetting);
        };
        darkModeHook.check();
        return () => {
            darkModeHook.check = () => {};
        };
    }, []);

    return (
        <div className="card m-1">
            <div className="card-header">{tran('Theme')}</div>
            <div className="card-body">
                <select
                    className="form-select"
                    aria-label="Default select example"
                    value={themeSource}
                    onChange={handleChange}
                >
                    <option value="light">{tran('Light')}</option>
                    <option value="dark">{tran('Dark')}</option>
                    <option value="system">{tran('System')}</option>
                </select>
            </div>
        </div>
    );
}
