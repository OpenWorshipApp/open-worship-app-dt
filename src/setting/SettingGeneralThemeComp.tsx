import { useState, useCallback, ChangeEvent } from 'react';

import { useAppEffect } from '../helper/debuggerHelpers';
import {
    applyDarkModeToApp,
    darkModeHook,
    getThemeSourceSetting,
    setThemeSourceSetting,
    ThemeOptionType,
} from '../initHelpers';

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
            <div className="card-header">`Theme</div>
            <div className="card-body">
                <select
                    className="form-select"
                    aria-label="Default select example"
                    value={themeSource}
                    onChange={handleChange}
                >
                    <option value="light">`Light</option>
                    <option value="dark">`Dark</option>
                    <option value="system">`System</option>
                </select>
            </div>
        </div>
    );
}
