import { type ChangeEvent, useCallback } from 'react';

import { tran } from '../lang/langHelpers';
import type { ThemeOptionType } from '../others/themeHelpers';
import { useThemeSource } from '../others/themeHelpers';

export default function SettingGeneralThemeComp() {
    const { themeSource, setThemeSource } = useThemeSource();
    const handleThemeChange = useCallback(
        (event: ChangeEvent<HTMLSelectElement>) => {
            const value = event.target.value;
            setThemeSource(value as ThemeOptionType);
        },
        [setThemeSource],
    );

    return (
        <div className="card m-1">
            <div className="card-header">{tran('Theme')}</div>
            <div className="card-body">
                <select
                    className="form-select"
                    aria-label="Default select example"
                    value={themeSource}
                    onChange={handleThemeChange}
                >
                    <option value="light">{tran('Light')}</option>
                    <option value="dark">{tran('Dark')}</option>
                    <option value="system">{tran('System')}</option>
                </select>
            </div>
        </div>
    );
}
