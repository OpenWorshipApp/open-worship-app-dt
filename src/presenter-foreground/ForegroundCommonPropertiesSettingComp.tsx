import { tran } from '../lang/langHelpers';
import FontFamilyControlComp from '../others/FontFamilyControlComp';
import {
    getSetting,
    useStateSettingBoolean,
    useStateSettingNumber,
    useStateSettingString,
} from '../helper/settingHelpers';
import ColorPicker from '../others/color/ColorPicker';

const FONT_FAMILY_SETTING_NAME = 'foreground-common-font-family';
const FONT_WEIGHT_SETTING_NAME = 'foreground-common-font-weight';
const TEXT_COLOR_SETTING_NAME = 'foreground-common-color';
const BACKGROUND_COLOR_SETTING_NAME = 'foreground-common-background-color';
const BACKDROP_FILTER_SETTING_NAME = 'foreground-common-backdrop-filter';
const DEFAULT_TEXT_COLOR = '#ffffff';
const DEFAULT_BACKGROUND_COLOR = '#000080AA';
const DEFAULT_BACKDROP_FILTER = 5;

export function getForegroundCommonProperties() {
    const backdropFilterSetting =
        getSetting(BACKDROP_FILTER_SETTING_NAME) ?? DEFAULT_BACKDROP_FILTER;
    return {
        fontFamily: getSetting(FONT_FAMILY_SETTING_NAME) ?? '',
        fontWeight: getSetting(FONT_WEIGHT_SETTING_NAME) ?? '',
        color: getSetting(TEXT_COLOR_SETTING_NAME) ?? DEFAULT_TEXT_COLOR,
        backgroundColor:
            getSetting(BACKGROUND_COLOR_SETTING_NAME) ??
            DEFAULT_BACKGROUND_COLOR,
        backdropFilter: `blur(${backdropFilterSetting}px)`,
    };
}

export default function ForegroundCommonPropertiesSettingComp() {
    const [isOpened, setIsOpened] = useStateSettingBoolean(
        `foreground-show-common-properties-setting`,
        false,
    );
    const [fontFamily, setFontFamily] = useStateSettingString(
        FONT_FAMILY_SETTING_NAME,
    );
    const [fontWeight, setFontWeight] = useStateSettingString(
        FONT_WEIGHT_SETTING_NAME,
    );
    const [color, setColor] = useStateSettingString(
        TEXT_COLOR_SETTING_NAME,
        DEFAULT_TEXT_COLOR,
    );
    const [backgroundColor, setBackgroundColor] = useStateSettingString(
        BACKGROUND_COLOR_SETTING_NAME,
        DEFAULT_BACKGROUND_COLOR,
    );
    const [backdropFilter, setBackdropFilter] = useStateSettingNumber(
        BACKDROP_FILTER_SETTING_NAME,
        DEFAULT_BACKDROP_FILTER,
    );
    if (!isOpened) {
        return (
            <button
                className="btn btn-sm btn-outline-secondary"
                onClick={() => {
                    setIsOpened(true);
                }}
            >
                <i className="bi bi-chevron-right" />
                <i className="bi bi-gear" /> {tran('Properties')}
            </button>
        );
    }
    return (
        <div>
            <div>
                <button
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() => {
                        setIsOpened(false);
                    }}
                >
                    <i className="bi bi-chevron-down" />
                    <i className="bi bi-gear" /> {tran('Properties')}
                </button>
            </div>
            <div
                className={
                    'd-flex flex-wrap justify-content-start ' +
                    'align-items-start app-inner-shadow p-2'
                }
            >
                <div>
                    <div className="app-border-white-round p-1 m-1">
                        <strong>Font:</strong>
                        <FontFamilyControlComp
                            fontFamily={fontFamily}
                            setFontFamily={setFontFamily}
                            fontWeight={fontWeight}
                            setFontWeight={setFontWeight}
                            isShowingLabel={false}
                        />
                    </div>
                    <div
                        className="input-group input-group-sm m-1 app-border-white-round"
                        style={{
                            width: '250px',
                        }}
                    >
                        <small>{tran('Backdrop Filter (PX):')}</small>
                        <input
                            className="form-control form-control-sm"
                            type="number"
                            min="0"
                            value={backdropFilter}
                            onChange={(e) => {
                                setBackdropFilter(
                                    Number.parseInt(e.target.value, 10),
                                );
                            }}
                        />
                    </div>
                </div>
                <div
                    className="p-1 m-1 app-border-white-round"
                    style={{ minWidth: '280px' }}
                >
                    <strong>{tran('Text Color:')}</strong>
                    <ColorPicker
                        color={color}
                        defaultColor={DEFAULT_TEXT_COLOR}
                        onNoColor={() => setColor(DEFAULT_TEXT_COLOR)}
                        onColorChange={(newColor: string) => {
                            setColor(newColor as any);
                        }}
                    />
                </div>
                <div
                    className="p-1 m-1 app-border-white-round"
                    style={{ minWidth: '280px' }}
                >
                    <strong>{tran('Background Color:')}</strong>
                    <ColorPicker
                        color={backgroundColor}
                        defaultColor={DEFAULT_BACKGROUND_COLOR}
                        onNoColor={() =>
                            setBackgroundColor(DEFAULT_BACKGROUND_COLOR)
                        }
                        onColorChange={(newColor: string) => {
                            setBackgroundColor(newColor as any);
                        }}
                    />
                </div>
            </div>
        </div>
    );
}
