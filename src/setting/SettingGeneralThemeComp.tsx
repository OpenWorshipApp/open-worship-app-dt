import { tran } from '../lang/langHelpers';
import type { ThemeOptionType } from '../others/initHelpers';
import { useThemeSource } from '../others/initHelpers';

export default function SettingGeneralThemeComp() {
    const { themeSource, setThemeSource } = useThemeSource();

    return (
        <div className="card m-1">
            <div className="card-header">{tran('Theme')}</div>
            <div className="card-body">
                <select
                    className="form-select"
                    aria-label="Default select example"
                    value={themeSource}
                    onChange={(event) => {
                        const value = event.target.value;
                        console.log(value);
                        setThemeSource(value as ThemeOptionType);
                    }}
                >
                    <option value="light">{tran('Light')}</option>
                    <option value="dark">{tran('Dark')}</option>
                    <option value="system">{tran('System')}</option>
                </select>
            </div>
        </div>
    );
}
