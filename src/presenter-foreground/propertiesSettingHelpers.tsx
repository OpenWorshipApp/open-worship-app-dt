import {
    type ChangeEvent,
    type ComponentProps,
    type ReactNode,
    useCallback,
    type CSSProperties,
} from 'react';

import { tran } from '../lang/langHelpers';
import {
    getSetting,
    useStateSettingBoolean,
    useStateSettingNumber,
    useStateSettingString,
} from '../helper/settingHelpers';
import SlideEditorToolAlignComp from '../slide-editor/canvas/tools/SlideEditorToolAlignComp';
import AppRangeComp from '../others/AppRangeComp';
import CommonStyleControlsComp, {
    DEFAULT_BACKDROP_FILTER,
    DEFAULT_BACKGROUND_COLOR,
    DEFAULT_TEXT_COLOR,
    genCommonStyleSettingNames,
    getForegroundCommonProperties,
} from './ForegroundCommonPropertiesSettingComp';
import { useAppCurrentRef } from '../helper/appHooks';

const DEFAULT_FONT_SIZE = 100;
const DEFAULT_WIDGET_WIDTH_PERCENTAGE = 50;
const DEFAULT_WIDGET_SCALE = 1;
const DEFAULT_WIDGET_OPACITY_PERCENTAGE = 100;
const DEFAULT_ROUND_PERCENTAGE = 50;
const DEFAULT_ROUND_SIZE_PIXEL = 5;
const DEFAULT_WIDGET_OFFSET_X = 0;
const DEFAULT_WIDGET_OFFSET_Y = 0;

function getWidgetRoundExtraStyle(
    settingNamePixel: string,
    settingNamePercentage: string,
): CSSProperties {
    const roundSizePixel = Number.parseInt(
        getSetting(settingNamePixel) ?? DEFAULT_ROUND_SIZE_PIXEL.toString(),
    );
    if (roundSizePixel > 0) {
        return {
            borderRadius: `${roundSizePixel}px`,
        };
    }
    const percentage = Number.parseInt(
        getSetting(settingNamePercentage) ??
            DEFAULT_ROUND_PERCENTAGE.toString(),
    );
    const roundPercentage = Math.round(
        Math.max(0, Math.min(100, percentage)) / 2,
    );
    return {
        borderRadius: `${roundPercentage}%`,
    };
}

function getWidgetWidthScale(settingName: string) {
    const widthScale = Number.parseInt(
        getSetting(settingName) ?? DEFAULT_WIDGET_WIDTH_PERCENTAGE.toString(),
    );
    return Math.max(1, Math.min(100, widthScale));
}
function genWidgetWidthExtraStyle(settingName: string): CSSProperties {
    const widthScale = getWidgetWidthScale(settingName);
    return {
        width: `${widthScale}%`,
        height: 'auto',
    };
}

function genWidgetOpacityExtraStyle(settingName: string): CSSProperties {
    const opacityScale = Number.parseInt(
        getSetting(settingName) ?? DEFAULT_WIDGET_OPACITY_PERCENTAGE.toString(),
    );
    return {
        opacity: Math.max(0, Math.min(100, opacityScale)) / 100,
    };
}

function extractNumber(n: number) {
    return [n < 0 ? '-' : '+', Math.abs(n)];
}

function genMinusCalc(n: number) {
    const [sign, abs] = extractNumber(n);
    return `calc(-50% ${sign} ${abs}px)`;
}

function genTransformScale(settingName: string) {
    const scale = Number.parseFloat(
        getSetting(settingName) ?? DEFAULT_WIDGET_SCALE.toString(),
    );
    return `scale(${scale})`;
}

function genTransformRotate() {
    return 'rotate(0deg)';
}

function genTransformingExtraStyle(
    alignSettingName: string,
    offsetXSettingName: string,
    offsetYSettingName: string,
    widgetScaleSettingName: string,
): CSSProperties {
    const widgetOffsetX = Number.parseInt(
        getSetting(offsetXSettingName) ?? DEFAULT_WIDGET_OFFSET_X.toString(),
    );
    const widgetOffsetY = Number.parseInt(
        getSetting(offsetYSettingName) ?? DEFAULT_WIDGET_OFFSET_Y.toString(),
    );
    const alignmentData = JSON.parse(getSetting(alignSettingName) ?? '{}');
    const { horizontalAlignment = 'center', verticalAlignment = 'center' } =
        alignmentData;
    const transformScale = genTransformScale(widgetScaleSettingName);
    const transformRotate = genTransformRotate();
    const transformScaleRotate = `${transformScale} ${transformRotate}`;
    if (horizontalAlignment === 'center' && verticalAlignment === 'center') {
        const translate =
            `translate(${genMinusCalc(widgetOffsetX)},` +
            ` ${genMinusCalc(widgetOffsetY)})`;
        const style = {
            left: '50%',
            top: '50%',
            transform: `${translate} ${transformScaleRotate}`,
        };
        return style;
    }
    let style: any = {
        transform: transformScaleRotate,
    };
    if (horizontalAlignment === 'center') {
        style = {
            left: '50%',
            transform:
                `translateX(${genMinusCalc(widgetOffsetX)})` +
                ` ${transformScaleRotate}`,
        };
    }
    if (verticalAlignment === 'center') {
        style = {
            top: '50%',
            transform:
                `translateY(${genMinusCalc(widgetOffsetY)})` +
                ` ${transformScaleRotate}`,
        };
    }
    if (horizontalAlignment === 'left') {
        style.left = `${widgetOffsetX}px`;
    } else if (horizontalAlignment === 'right') {
        style.right = `${widgetOffsetX}px`;
    }
    if (verticalAlignment === 'start') {
        style.top = `${widgetOffsetY}px`;
    } else if (verticalAlignment === 'end') {
        style.bottom = `${widgetOffsetY}px`;
    }
    return style;
}

function getFontSizeStyle(fontSizeSettingName: string): CSSProperties {
    const fontSize = Number.parseInt(
        getSetting(fontSizeSettingName) ?? DEFAULT_FONT_SIZE.toString(),
    );
    return {
        fontSize: `${fontSize}px`,
    };
}

function wrapSetter<T>(
    setter: (value: T) => void,
    afterChange: () => void,
): (value: T) => void {
    return (value: T) => {
        setter(value);
        afterChange();
    };
}

function PropGroupComp({
    iconClassName,
    label,
    isDimmed,
    children,
}: Readonly<{
    iconClassName: string;
    label: string;
    isDimmed?: boolean;
    children: ReactNode;
}>) {
    return (
        <div
            className="d-flex align-items-center app-border-white-round m-1 px-2 gap-1"
            style={isDimmed ? { opacity: 0.5 } : undefined}
        >
            <span className="d-flex align-items-center gap-1 text-nowrap">
                <i className={iconClassName} />
                <small>{label}</small>
            </span>
            {children}
        </div>
    );
}

function PropertiesSettingComp({
    alignmentData,
    setAlignmentData,
    widgetWidthPercentage,
    setWidgetWidthPercentage,
    widgetScale,
    setWidgetScale,
    opacityPercentage,
    setOpacityPercentage,
    roundPercentage,
    setRoundPercentage,
    widgetOffsetX,
    setWidgetOffsetX,
    widgetOffsetY,
    setWidgetOffsetY,
    isFontSize,
    fontSize,
    setFontSize,
    roundSizePixel,
    setRoundSizePixel,
    isGeometry,
    isCommonStyle,
    commonStyleProps,
    extraControls,
    target,
}: Readonly<{
    alignmentData: string;
    setAlignmentData: (data: string) => void;
    widgetWidthPercentage: number;
    setWidgetWidthPercentage: (value: number) => void;
    widgetScale: number;
    setWidgetScale: (value: number) => void;
    opacityPercentage: number;
    setOpacityPercentage: (value: number) => void;
    roundPercentage: number;
    setRoundPercentage: (value: number) => void;
    widgetOffsetX: number;
    setWidgetOffsetX: (value: number) => void;
    widgetOffsetY: number;
    setWidgetOffsetY: (value: number) => void;
    isFontSize: boolean;
    fontSize: number;
    setFontSize: (value: number) => void;
    roundSizePixel: number;
    setRoundSizePixel: (value: number) => void;
    isGeometry: boolean;
    isCommonStyle: boolean;
    commonStyleProps: ComponentProps<typeof CommonStyleControlsComp>;
    extraControls?: ReactNode;
    target: string;
}>) {
    const [isOpened, setIsOpened] = useStateSettingBoolean(
        `foreground-${target}-show-properties-setting`,
        false,
    );
    const setIsOpenedRef = useAppCurrentRef(setIsOpened);
    const handleToggle = useCallback(() => {
        setIsOpenedRef.current((old) => !old);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const setWidgetOffsetXRef = useAppCurrentRef(setWidgetOffsetX);
    const handleOffsetXChange = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => {
            setWidgetOffsetXRef.current(
                Number.parseInt(event.target.value) || 0,
            );
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    const setWidgetOffsetYRef = useAppCurrentRef(setWidgetOffsetY);
    const handleOffsetYChange = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => {
            setWidgetOffsetYRef.current(
                Number.parseInt(event.target.value) || 0,
            );
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    const setRoundSizePixelRef = useAppCurrentRef(setRoundSizePixel);
    const handleRoundSizePixelChange = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => {
            setRoundSizePixelRef.current(
                Number.parseInt(event.target.value) || 0,
            );
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    const setFontSizeRef = useAppCurrentRef(setFontSize);
    const handleFontSizeChange = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => {
            setFontSizeRef.current(
                Number.parseInt(event.target.value) || DEFAULT_FONT_SIZE,
            );
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    const toggleButton = (
        <button
            type="button"
            className={
                'btn btn-sm d-inline-flex align-items-center gap-2 px-3' +
                ' rounded-pill' +
                (isOpened ? ' btn-secondary' : ' btn-outline-secondary')
            }
            onClick={handleToggle}
            title={tran('Properties')}
        >
            <i className="bi bi-sliders2" />
            <span className="fw-semibold">{tran('Properties')}</span>
            <i
                className="bi bi-chevron-down"
                style={{
                    transition: 'transform 0.2s ease',
                    transform: isOpened ? 'rotate(180deg)' : 'rotate(0deg)',
                }}
            />
        </button>
    );
    if (!isOpened) {
        return toggleButton;
    }
    return (
        <div>
            <div className="mb-1">{toggleButton}</div>
            <div className="app-inner-shadow">
                {isGeometry || isFontSize || extraControls ? (
                    <div className="d-flex flex-wrap p-1 align-items-center gap-1">
                        {isGeometry ? (
                            <>
                                <PropGroupComp
                                    iconClassName="bi bi-align-center"
                                    label={tran('Align')}
                                >
                                    <SlideEditorToolAlignComp
                                        data={JSON.parse(alignmentData)}
                                        onData={(data) => {
                                            const oldData =
                                                JSON.parse(alignmentData);
                                            setAlignmentData(
                                                JSON.stringify({
                                                    ...oldData,
                                                    ...data,
                                                }),
                                            );
                                        }}
                                    />
                                </PropGroupComp>
                                <div
                                    className="d-flex input-group m-1"
                                    style={{ width: '330px', height: '35px' }}
                                    title={tran('Position offset in pixels')}
                                >
                                    <span className="input-group-text">
                                        <i className="bi bi-arrows-move" />
                                    </span>
                                    <span className="input-group-text">X</span>
                                    <input
                                        className="form-control form-control-sm"
                                        type="number"
                                        value={widgetOffsetX}
                                        onChange={handleOffsetXChange}
                                    />
                                    <span className="input-group-text">Y</span>
                                    <input
                                        className="form-control form-control-sm"
                                        type="number"
                                        value={widgetOffsetY}
                                        onChange={handleOffsetYChange}
                                    />
                                    <span className="input-group-text">px</span>
                                </div>
                                <PropGroupComp
                                    iconClassName="bi bi-arrows"
                                    label={tran('Width (%)')}
                                >
                                    <AppRangeComp
                                        value={widgetWidthPercentage}
                                        title={tran('Width (%)')}
                                        setValue={setWidgetWidthPercentage}
                                        defaultSize={{
                                            size: widgetWidthPercentage,
                                            min: 1,
                                            max: 100,
                                            step: 1,
                                        }}
                                        isShowValue
                                    />
                                </PropGroupComp>
                                <PropGroupComp
                                    iconClassName="bi bi-arrows-fullscreen"
                                    label={tran('Scale')}
                                >
                                    <AppRangeComp
                                        value={widgetScale}
                                        title={tran('Scale')}
                                        setValue={setWidgetScale}
                                        defaultSize={{
                                            size: widgetScale,
                                            min: 0.1,
                                            max: 3,
                                            step: 0.1,
                                        }}
                                        isShowValue
                                    />
                                </PropGroupComp>
                                <PropGroupComp
                                    iconClassName="bi bi-circle-half"
                                    label={tran('Opacity')}
                                >
                                    <AppRangeComp
                                        value={opacityPercentage}
                                        title={tran('Opacity (%)')}
                                        setValue={setOpacityPercentage}
                                        defaultSize={{
                                            size: opacityPercentage,
                                            min: 0,
                                            max: 100,
                                            step: 1,
                                        }}
                                        isShowValue
                                    />
                                </PropGroupComp>
                                <PropGroupComp
                                    iconClassName="bi bi-app"
                                    label={tran('Round (%)')}
                                    isDimmed={roundSizePixel > 0}
                                >
                                    <AppRangeComp
                                        value={roundPercentage}
                                        title={
                                            roundSizePixel > 0
                                                ? 'Set round size pixel to 0' +
                                                  ' to use this'
                                                : tran('Round (%)')
                                        }
                                        setValue={setRoundPercentage}
                                        defaultSize={{
                                            size: roundPercentage,
                                            min: 0,
                                            max: 100,
                                            step: 1,
                                        }}
                                        isShowValue
                                    />
                                </PropGroupComp>
                                <div
                                    className="d-flex input-group m-1"
                                    style={{ width: '200px', height: '35px' }}
                                    title={tran(
                                        'Corner radius in pixels (0 to use %)',
                                    )}
                                >
                                    <span className="input-group-text">
                                        <i className="bi bi-app" />
                                    </span>
                                    <input
                                        className="form-control form-control-sm"
                                        type="number"
                                        value={roundSizePixel}
                                        min={0}
                                        onChange={handleRoundSizePixelChange}
                                    />
                                    <span className="input-group-text">px</span>
                                </div>
                            </>
                        ) : null}
                        {isFontSize ? (
                            <div
                                className="d-flex input-group m-1"
                                style={{ width: '180px', height: '35px' }}
                                title={tran('Font size in pixels')}
                            >
                                <span className="input-group-text">
                                    <i className="bi bi-fonts" />
                                </span>
                                <input
                                    className="form-control form-control-sm"
                                    type="number"
                                    value={fontSize}
                                    onChange={handleFontSizeChange}
                                />
                                <span className="input-group-text">px</span>
                            </div>
                        ) : null}
                        {extraControls}
                    </div>
                ) : null}
                {isCommonStyle ? (
                    <CommonStyleControlsComp {...commonStyleProps} />
                ) : null}
            </div>
        </div>
    );
}

export function useForegroundPropsSetting({
    prefix,
    onChange,
    isFontSize = false,
    isGeometry = true,
    isCommonStyle = true,
    extraControls,
}: Readonly<{
    prefix: string;
    onChange: (style: CSSProperties) => void;
    isFontSize?: boolean;
    isGeometry?: boolean;
    isCommonStyle?: boolean;
    extraControls?: ReactNode;
}>) {
    const widgetRoundPercentageSettingName = `${prefix}-setting-show-widget-round-percentage`;
    const widgetWidthPercentageSettingName = `${prefix}-setting-show-widget-width-percentage`;
    const widgetScaleSettingName = `${prefix}-setting-show-widget-scale`;
    const opacityPercentageSettingName = `${prefix}-setting-show-widget-opacity-percentage`;
    const alignmentSettingName = `${prefix}-setting-show-widget-alignment-data`;
    const offsetXSettingName = `${prefix}-setting-show-widget-offset-x`;
    const offsetYSettingName = `${prefix}-setting-show-widget-offset-y`;
    const fontSizeSettingName = `${prefix}-setting-show-widget-font-size`;
    const roundSizePixelSettingName = `${prefix}-setting-show-widget-round-size-px`;
    const commonNames = genCommonStyleSettingNames(prefix);

    const genStyle: () => CSSProperties = () => {
        const style: CSSProperties = {};
        if (isCommonStyle) {
            Object.assign(style, getForegroundCommonProperties(prefix));
        }
        if (isGeometry) {
            Object.assign(style, {
                position: 'absolute',
                height: 'auto',
                ...getWidgetRoundExtraStyle(
                    roundSizePixelSettingName,
                    widgetRoundPercentageSettingName,
                ),
                ...genWidgetWidthExtraStyle(widgetWidthPercentageSettingName),
                ...genWidgetOpacityExtraStyle(opacityPercentageSettingName),
                ...genTransformingExtraStyle(
                    alignmentSettingName,
                    offsetXSettingName,
                    offsetYSettingName,
                    widgetScaleSettingName,
                ),
            });
        }
        if (isFontSize) {
            Object.assign(style, getFontSizeStyle(fontSizeSettingName));
        }
        return style;
    };

    const onChange1 = () => {
        onChange(genStyle());
    };

    const [widgetOffsetX, setWidgetOffsetX] = useStateSettingNumber(
        offsetXSettingName,
        DEFAULT_WIDGET_OFFSET_X,
    );
    const [widgetOffsetY, setWidgetOffsetY] = useStateSettingNumber(
        offsetYSettingName,
        DEFAULT_WIDGET_OFFSET_Y,
    );
    const [roundPercentage, setRoundPercentage] = useStateSettingNumber(
        widgetRoundPercentageSettingName,
        DEFAULT_ROUND_PERCENTAGE,
    );
    const [widgetWidthPercentage, setWidgetWidthPercentage] =
        useStateSettingNumber(
            widgetWidthPercentageSettingName,
            DEFAULT_WIDGET_WIDTH_PERCENTAGE,
        );
    const [widgetScale, setWidgetScale] = useStateSettingNumber(
        widgetScaleSettingName,
        DEFAULT_WIDGET_SCALE,
    );
    const [opacityPercentage, setOpacityPercentage] = useStateSettingNumber(
        opacityPercentageSettingName,
        DEFAULT_WIDGET_OPACITY_PERCENTAGE,
    );
    const [alignmentData, setAlignmentData] = useStateSettingString(
        alignmentSettingName,
        JSON.stringify({
            horizontalAlignment: 'center',
            verticalAlignment: 'center',
        }),
    );
    const [fontSize, setFontSize] = useStateSettingNumber(
        fontSizeSettingName,
        DEFAULT_FONT_SIZE,
    );
    const [roundSizePixel, setRoundSizePixel] = useStateSettingNumber(
        roundSizePixelSettingName,
        DEFAULT_ROUND_SIZE_PIXEL,
    );
    const [fontFamily, setFontFamily] = useStateSettingString(
        commonNames.fontFamily,
        '',
    );
    const [fontWeight, setFontWeight] = useStateSettingString(
        commonNames.fontWeight,
        '',
    );
    const [textColor, setTextColor] = useStateSettingString(
        commonNames.color,
        DEFAULT_TEXT_COLOR,
    );
    const [backgroundColor, setBackgroundColor] = useStateSettingString(
        commonNames.backgroundColor,
        DEFAULT_BACKGROUND_COLOR,
    );
    const [backdropFilter, setBackdropFilter] = useStateSettingNumber(
        commonNames.backdropFilter,
        DEFAULT_BACKDROP_FILTER,
    );

    return {
        genStyle,
        fontFamily,
        fontWeight,
        getWidthScale: () => {
            return getWidgetWidthScale(widgetWidthPercentageSettingName);
        },
        element: (
            <PropertiesSettingComp
                alignmentData={alignmentData}
                setAlignmentData={wrapSetter(setAlignmentData, onChange1)}
                widgetWidthPercentage={widgetWidthPercentage}
                setWidgetWidthPercentage={wrapSetter(
                    setWidgetWidthPercentage,
                    onChange1,
                )}
                widgetScale={widgetScale}
                setWidgetScale={wrapSetter(setWidgetScale, onChange1)}
                opacityPercentage={opacityPercentage}
                setOpacityPercentage={wrapSetter(
                    setOpacityPercentage,
                    onChange1,
                )}
                roundPercentage={roundPercentage}
                setRoundPercentage={wrapSetter(setRoundPercentage, onChange1)}
                widgetOffsetX={widgetOffsetX}
                setWidgetOffsetX={wrapSetter(setWidgetOffsetX, onChange1)}
                widgetOffsetY={widgetOffsetY}
                setWidgetOffsetY={wrapSetter(setWidgetOffsetY, onChange1)}
                isFontSize={isFontSize}
                fontSize={fontSize}
                setFontSize={wrapSetter(setFontSize, onChange1)}
                roundSizePixel={roundSizePixel}
                setRoundSizePixel={wrapSetter(setRoundSizePixel, onChange1)}
                isGeometry={isGeometry}
                isCommonStyle={isCommonStyle}
                extraControls={extraControls}
                commonStyleProps={{
                    fontFamily,
                    setFontFamily: wrapSetter(setFontFamily, onChange1),
                    fontWeight,
                    setFontWeight: wrapSetter(setFontWeight, onChange1),
                    color: textColor,
                    setColor: wrapSetter(setTextColor, onChange1),
                    backgroundColor,
                    setBackgroundColor: wrapSetter(
                        setBackgroundColor,
                        onChange1,
                    ),
                    backdropFilter,
                    setBackdropFilter: wrapSetter(setBackdropFilter, onChange1),
                }}
                target={prefix}
            />
        ),
    };
}
