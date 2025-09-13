import { useState } from 'react';

import { useAppEffect } from '../helper/debuggerHelpers';
import {
    applyDarkModeToApp,
    darkModeHook,
    getIsDarkModeSetting,
    setIsDarkModeSetting,
} from '../initHelpers';

export default function SettingGeneralThemeComp() {
    const [mode, setMode] = useState<'light' | 'dark' | 'system'>('system');
    const setMode1 = (newMode: 'light' | 'dark' | 'system') => {
        setMode(newMode);
        console.log(newMode);

        if (newMode === 'system') {
            setIsDarkModeSetting(null);
        } else {
            setIsDarkModeSetting(newMode === 'dark');
        }
        applyDarkModeToApp();
    };
    useAppEffect(() => {
        darkModeHook.check = () => {
            const settingMode = getIsDarkModeSetting();
            let newMode = 'system';
            if (settingMode === true) {
                newMode = 'dark';
            } else if (settingMode === false) {
                newMode = 'light';
            }
            setMode(newMode as any);
        };
        darkModeHook.check();
        return () => {
            darkModeHook.check = () => {};
        };
    }, []);
    return (
        <div className="card">
            <div className="card-header">`Theme</div>
            <div className="card-body">
                <select
                    className="form-select"
                    aria-label="Default select example"
                    value={mode}
                    onChange={(e) => {
                        const value = e.target.value;
                        setMode1(value as any);
                    }}
                >
                    <option value="light">`Light</option>
                    <option value="dark">`Dark</option>
                    <option value="system">`System</option>
                </select>
            </div>
        </div>
    );
}
