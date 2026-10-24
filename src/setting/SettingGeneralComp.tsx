import SettingGeneralLanguageComp from './SettingGeneralLanguageComp';
import SettingGeneralThemeComp from './SettingGeneralThemeComp';
import SettingGeneralOtherOptionsComp from './SettingGeneralOtherOptionsComp';
import SettingGeneralFontFamilyComp from './SettingGeneralFontFamilyComp';
import { appLocalStorage } from './directory-setting/appLocalStorage';

// The directory paths moved to the Path Settings tab; General keeps the
// look and language of the app only.
export default function SettingGeneralComp() {
    return (
        <div
            className="w-100 h-100 d-flex flex-wrap justify-content-center p-1"
            style={{
                overflowY: 'auto',
            }}
        >
            <div
                className="app-border-white-round m-1"
                // Grows to use the freed width since the path column moved to
                // its own tab, capped so the controls keep readable lines.
                style={{ width: '100%', maxWidth: '720px' }}
            >
                <SettingGeneralLanguageComp />
                <SettingGeneralThemeComp />
                {/* The rest is kept in a data folder; with none there is
                    only what belongs to the computer. */}
                {appLocalStorage.isOnOwnFolder ? null : (
                    <>
                        <SettingGeneralFontFamilyComp />
                        <SettingGeneralOtherOptionsComp />
                    </>
                )}
            </div>
        </div>
    );
}
