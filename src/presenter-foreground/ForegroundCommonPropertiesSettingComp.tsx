import {
    type ChangeEvent,
    type CSSProperties,
    type ReactNode,
    useState,
} from 'react';

import { tran } from '../lang/langHelpers';
import FontFamilyControlComp from '../others/FontFamilyControlComp';
import { getSetting } from '../helper/settingHelpers';
import ColorPicker from '../others/color/ColorPicker';
import {
    type AppColorType,
    HEX_COLOR_WHITE,
} from '../others/color/colorHelpers';

export const DEFAULT_TEXT_COLOR = HEX_COLOR_WHITE;
export const DEFAULT_BACKGROUND_COLOR: AppColorType = '#000080AA';
export const DEFAULT_BACKDROP_FILTER = 5;

export function genCommonStyleSettingNames(prefix: string) {
    return {
        fontFamily: `${prefix}-common-font-family`,
        fontWeight: `${prefix}-common-font-weight`,
        color: `${prefix}-common-color`,
        backgroundColor: `${prefix}-common-background-color`,
        backdropFilter: `${prefix}-common-backdrop-filter`,
    };
}

export function getForegroundCommonProperties(prefix: string) {
    const names = genCommonStyleSettingNames(prefix);
    const backdropFilterSetting =
        getSetting(names.backdropFilter) ?? DEFAULT_BACKDROP_FILTER;
    return {
        fontFamily: getSetting(names.fontFamily) ?? '',
        fontWeight: getSetting(names.fontWeight) ?? '',
        color: getSetting(names.color) ?? DEFAULT_TEXT_COLOR,
        backgroundColor:
            getSetting(names.backgroundColor) ?? DEFAULT_BACKGROUND_COLOR,
        backdropFilter: `blur(${backdropFilterSetting}px)`,
    };
}

function PropCardComp({
    iconClassName,
    label,
    style,
    children,
}: Readonly<{
    iconClassName: string;
    label: string;
    style?: CSSProperties;
    children: ReactNode;
}>) {
    return (
        <div className="app-border-white-round p-2" style={style}>
            <div className="d-flex align-items-center gap-2 mb-2">
                <i className={`${iconClassName} opacity-75`} />
                <strong>{label}</strong>
            </div>
            {children}
        </div>
    );
}

function ColorPropCardComp({
    iconClassName,
    label,
    color,
    children,
}: Readonly<{
    iconClassName: string;
    label: string;
    color: string;
    children: ReactNode;
}>) {
    const [isOpened, setIsOpened] = useState(false);
    return (
        <div className="app-border-white-round p-2">
            <div
                className="d-flex align-items-center gap-2 app-caught-hover-pointer"
                onClick={() => setIsOpened((old) => !old)}
                title={label}
            >
                <i className={`bi bi-chevron-${isOpened ? 'down' : 'right'}`} />
                <i
                    className={iconClassName}
                    style={{
                        color,
                        textShadow: '0 0 2px rgba(128,128,128,0.9)',
                    }}
                />
                <strong>{label}</strong>
            </div>
            {isOpened ? <div className="mt-2">{children}</div> : null}
        </div>
    );
}

export default function CommonStyleControlsComp({
    fontFamily,
    setFontFamily,
    fontWeight,
    setFontWeight,
    color,
    setColor,
    backgroundColor,
    setBackgroundColor,
    backdropFilter,
    setBackdropFilter,
}: Readonly<{
    fontFamily: string;
    setFontFamily: (value: string) => void;
    fontWeight: string;
    setFontWeight: (value: string) => void;
    color: AppColorType;
    setColor: (value: AppColorType) => void;
    backgroundColor: AppColorType;
    setBackgroundColor: (value: AppColorType) => void;
    backdropFilter: number;
    setBackdropFilter: (value: number) => void;
}>) {
    const handleBackdropFilterChange = (e: ChangeEvent<HTMLInputElement>) => {
        setBackdropFilter(Number.parseInt(e.target.value, 10) || 0);
    };
    return (
        <div className="d-flex flex-wrap gap-2 align-items-start p-1">
            <div
                className="d-flex flex-column gap-2"
                style={{ minWidth: '260px' }}
            >
                <PropCardComp
                    iconClassName="bi bi-fonts"
                    label={tran('Font Family')}
                >
                    <FontFamilyControlComp
                        fontFamily={fontFamily}
                        setFontFamily={setFontFamily}
                        fontWeight={fontWeight}
                        setFontWeight={setFontWeight}
                        isShowingLabel={false}
                    />
                </PropCardComp>
                <PropCardComp
                    iconClassName="bi bi-droplet-half"
                    label={tran('Backdrop Filter')}
                >
                    <div className="input-group input-group-sm">
                        <input
                            className="form-control form-control-sm"
                            type="number"
                            min="0"
                            value={backdropFilter}
                            onChange={handleBackdropFilterChange}
                        />
                        <span className="input-group-text">px</span>
                    </div>
                </PropCardComp>
            </div>
            <div
                className="d-flex flex-column gap-2"
                style={{ minWidth: '300px' }}
            >
                <ColorPropCardComp
                    iconClassName="bi bi-palette"
                    label={tran('Text Color:')}
                    color={color}
                >
                    <ColorPicker
                        color={color}
                        defaultColor={DEFAULT_TEXT_COLOR}
                        onNoColor={() => setColor(DEFAULT_TEXT_COLOR)}
                        onColorChange={setColor}
                    />
                </ColorPropCardComp>
                <ColorPropCardComp
                    iconClassName="bi bi-paint-bucket"
                    label={tran('Background Color:')}
                    color={backgroundColor}
                >
                    <ColorPicker
                        color={backgroundColor}
                        defaultColor={DEFAULT_BACKGROUND_COLOR}
                        onNoColor={() =>
                            setBackgroundColor(DEFAULT_BACKGROUND_COLOR)
                        }
                        onColorChange={setBackgroundColor}
                    />
                </ColorPropCardComp>
            </div>
        </div>
    );
}
