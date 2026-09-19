import { type ChangeEvent, useCallback } from 'react';

import { tran } from '../lang/langHelpers';
import type { ThemeOptionType } from '../others/themeHelpers';
import { useThemeSource } from '../others/themeHelpers';
import { useAppCurrentRef } from '../helper/appHooks';
import SettingCardHeaderComp from './SettingCardHeaderComp';

export default function SettingGeneralThemeComp() {
    const { themeSource, setThemeSource } = useThemeSource();
    const setThemeSourceRef = useAppCurrentRef(setThemeSource);
    const handleThemeChange = useCallback(
        (event: ChangeEvent<HTMLSelectElement>) => {
            const value = event.target.value;
            setThemeSourceRef.current(value as ThemeOptionType);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );

    return (
        <div className="card m-1">
            <SettingCardHeaderComp iconClassName="bi-palette" title="Theme" />
            <div className="card-body">
                <select
                    className="form-select"
                    aria-label={tran('Theme')}
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
