import SettingGeneralLanguageComp from './SettingGeneralLanguageComp';
import appProvider from '../server/appProvider';
import SettingGeneralPath from './directory-setting/SettingGeneralDirectoryPathComp';
import SettingGeneralThemeComp from './SettingGeneralThemeComp';
import SettingGeneralOtherOptionsComp from './SettingGeneralOtherOptionsComp';
import SettingGeneralFontFamilyComp from './SettingGeneralFontFamilyComp';
import SettingGeneralBinPathComp from './SettingGeneralBinPathComp';

export default function SettingGeneralComp() {
    return (
        <div
            className="w-100 h-100 d-flex flex-wrap justify-content-center p-1"
            style={{
                overflowY: 'auto',
            }}
        >
            <div className="m-1" style={{ minWidth: '600px' }}>
                <SettingGeneralPath />
            </div>
            <div className="app-border-white-round m-1">
                {appProvider.systemUtils.isDev ? (
                    <SettingGeneralLanguageComp />
                ) : null}
                <SettingGeneralThemeComp />
                <SettingGeneralFontFamilyComp />
                <SettingGeneralOtherOptionsComp />
                <SettingGeneralBinPathComp />
            </div>
        </div>
    );
}
