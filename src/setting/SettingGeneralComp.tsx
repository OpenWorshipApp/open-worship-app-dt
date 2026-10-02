import SettingGeneralLanguageComp from './SettingGeneralLanguageComp';
import SettingGeneralPath from './directory-setting/SettingGeneralDirectoryPathComp';
import SettingGeneralThemeComp from './SettingGeneralThemeComp';
import SettingGeneralOtherOptionsComp from './SettingGeneralOtherOptionsComp';
import SettingGeneralFontFamilyComp from './SettingGeneralFontFamilyComp';

export default function SettingGeneralComp() {
    return (
        <div
            className="w-100 h-100 d-flex flex-wrap justify-content-center p-1"
            style={{
                overflowY: 'auto',
            }}
        >
            {/* A 600px BASIS, not the content's width: sized by its longest
                path, this column grew until the language column wrapped under
                it, and in Khmer, whose headings are wider, the switch back to
                English fell off the first screen. The paths ellipsize from the
                left (`PathPreviewerComp`), so the column can give way. */}
            <div
                className="m-1"
                style={{ minWidth: '600px', flex: '1 1 600px' }}
            >
                <SettingGeneralPath />
            </div>
            <div
                className="app-border-white-round m-1"
                style={{ minWidth: '320px', flex: '0 0 auto' }}
            >
                <SettingGeneralLanguageComp />
                <SettingGeneralThemeComp />
                <SettingGeneralFontFamilyComp />
                <SettingGeneralOtherOptionsComp />
            </div>
        </div>
    );
}
