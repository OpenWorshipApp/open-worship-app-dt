import {
    getSetting,
    useStateSettingBoolean,
    useStateSettingNumber,
    useStateSettingString,
} from '../helper/settingHelpers';
import SlideEditorToolAlignComp from '../slide-editor/canvas/tools/SlideEditorToolAlignComp';
import AppRangeComp from '../others/AppRangeComp';

const DEFAULT_FONT_SIZE = 100;
const DEFAULT_WIDGET_WIDTH_PERCENTAGE = 50;
const DEFAULT_WIDGET_OPACITY_PERCENTAGE = 100;
const DEFAULT_ROUND_PERCENTAGE = 50;
const DEFAULT_ROUND_SIZE_PIXEL = 5;
const DEFAULT_WIDGET_OFFSET_X = 0;
const DEFAULT_WIDGET_OFFSET_Y = 0;

function getWidgetRoundExtraStyle(
    settingNamePixel: string,
    settingNamePercentage: string,
): React.CSSProperties {
    const roundSizePixel = parseInt(
        getSetting(settingNamePixel, DEFAULT_ROUND_SIZE_PIXEL.toString()),
    );
    if (roundSizePixel > 0) {
        return {
            borderRadius: `${roundSizePixel}px`,
        };
    }
    const percentage = parseInt(
        getSetting(settingNamePercentage, DEFAULT_ROUND_PERCENTAGE.toString()),
    );
    const roundPercentage = Math.ceil(
        Math.max(0, Math.min(100, percentage)) / 2,
    );
    return {
        borderRadius: `${roundPercentage}%`,
    };
}

function genWidgetWidthExtraStyle(settingName: string): React.CSSProperties {
    const widthScale = parseInt(
        getSetting(settingName, DEFAULT_WIDGET_WIDTH_PERCENTAGE.toString()),
    );
    return {
        width: `${Math.max(1, Math.min(100, widthScale))}%`,
        height: 'auto',
    };
}

function genWidgetOpacityExtraStyle(settingName: string): React.CSSProperties {
    const opacityScale = parseInt(
        getSetting(settingName, DEFAULT_WIDGET_OPACITY_PERCENTAGE.toString()),
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

function genAlignmentExtraStyle(
    alignSettingName: string,
    offsetXSettingName: string,
    offsetYSettingName: string,
): React.CSSProperties {
    const widgetOffsetX = parseInt(
        getSetting(offsetXSettingName, DEFAULT_WIDGET_OFFSET_X.toString()),
    );
    const widgetOffsetY = parseInt(
        getSetting(offsetYSettingName, DEFAULT_WIDGET_OFFSET_Y.toString()),
    );
    const alignmentData = JSON.parse(getSetting(alignSettingName, '{}'));
    const { horizontalAlignment = 'center', verticalAlignment = 'center' } =
        alignmentData;
    if (horizontalAlignment === 'center' && verticalAlignment === 'center') {
        const style = {
            left: '50%',
            top: '50%',
            transform:
                `translate(${genMinusCalc(widgetOffsetX)},` +
                ` ${genMinusCalc(widgetOffsetY)})`,
        };
        return style;
    }
    let style: any = {};
    if (horizontalAlignment === 'center') {
        style = {
            left: '50%',
            transform: `translateX(${genMinusCalc(widgetOffsetX)})`,
        };
    }
    if (verticalAlignment === 'center') {
        style = {
            top: '50%',
            transform: `translateY(${genMinusCalc(widgetOffsetY)})`,
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

function getFontSizeStyle(fontSizeSettingName: string): React.CSSProperties {
    const fontSize = parseInt(
        getSetting(fontSizeSettingName, DEFAULT_FONT_SIZE.toString()),
    );
    return {
        fontSize: `${fontSize}px`,
    };
}

function PropertiesSettingComp({
    alignmentData,
    setAlignmentData,
    widgetWidthPercentage,
    setWidgetWidthPercentage,
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
    target,
}: Readonly<{
    alignmentData: string;
    setAlignmentData: (data: string) => void;
    widgetWidthPercentage: number;
    setWidgetWidthPercentage: (value: number) => void;
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
    target: string;
}>) {
    const [isOpened, setIsOpened] = useStateSettingBoolean(
        `foreground-${target}-show-properties-setting`,
        false,
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
                <i className="bi bi-gear" />
                {' `Properties'}
            </button>
        );
    }
    return (
        <div>
            <button
                className="btn btn-sm btn-outline-secondary"
                onClick={() => {
                    setIsOpened(false);
                }}
            >
                <i className="bi bi-chevron-down" />
                <i className="bi bi-gear" />
                {' `Properties'}
            </button>
            <div className="d-flex flex-wrap p-1 align-items-center app-inner-shadow">
                <div className="m-1">
                    <SlideEditorToolAlignComp
                        data={JSON.parse(alignmentData)}
                        onData={(data) => {
                            const oldData = JSON.parse(alignmentData);
                            setAlignmentData(
                                JSON.stringify({
                                    ...oldData,
                                    ...data,
                                }),
                            );
                        }}
                    />
                </div>
                <div
                    className="d-flex input-group m-1"
                    style={{ width: '330px', height: '35px' }}
                >
                    <div className="input-group-text">Offset X:</div>
                    <input
                        type="number"
                        className="form-control"
                        value={widgetOffsetX}
                        onChange={(event) => {
                            setWidgetOffsetX(parseInt(event.target.value) || 0);
                        }}
                    />
                    <div className="input-group-text">Offset Y:</div>
                    <input
                        type="number"
                        className="form-control"
                        value={widgetOffsetY}
                        onChange={(event) => {
                            setWidgetOffsetY(parseInt(event.target.value) || 0);
                        }}
                    />
                </div>
                <div className="d-flex app-border-white-round m-1">
                    `Width:
                    <AppRangeComp
                        value={widgetWidthPercentage}
                        title="`Width (%)"
                        setValue={setWidgetWidthPercentage}
                        defaultSize={{
                            size: widgetWidthPercentage,
                            min: 1,
                            max: 100,
                            step: 1,
                        }}
                        isShowValue
                    />
                </div>
                <div className="d-flex app-border-white-round m-1">
                    `Opacity:
                    <AppRangeComp
                        value={opacityPercentage}
                        title="`Opacity (%)"
                        setValue={setOpacityPercentage}
                        defaultSize={{
                            size: opacityPercentage,
                            min: 0,
                            max: 100,
                            step: 1,
                        }}
                        isShowValue
                    />
                </div>
                <div
                    className="d-flex app-border-white-round m-1"
                    style={{
                        opacity: roundSizePixel > 0 ? 0.5 : 1,
                    }}
                >
                    `Round Size %:
                    <AppRangeComp
                        value={roundPercentage}
                        title={
                            roundSizePixel > 0
                                ? 'Set round size pixel to 0 to use this'
                                : '`Round (%)'
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
                </div>
                <div
                    className="d-flex input-group m-1"
                    style={{ width: '260px', height: '35px' }}
                >
                    <div className="input-group-text">`Round size pixel:</div>
                    <input
                        type="number"
                        className="form-control"
                        value={roundSizePixel}
                        onChange={(event) => {
                            setRoundSizePixel(
                                parseInt(event.target.value) || 0,
                            );
                        }}
                    />
                    <div className="input-group-text">px</div>
                </div>
                {isFontSize ? (
                    <div
                        className="d-flex input-group m-1"
                        style={{ width: '220px', height: '35px' }}
                    >
                        <div className="input-group-text">Font Size:</div>
                        <input
                            type="number"
                            className="form-control"
                            value={fontSize}
                            onChange={(event) => {
                                setFontSize(
                                    parseInt(event.target.value) ||
                                        DEFAULT_FONT_SIZE,
                                );
                            }}
                        />
                        <div className="input-group-text">px</div>
                    </div>
                ) : null}
            </div>
        </div>
    );
}

export function useForegroundPropsSetting({
    prefix,
    onChange,
    isFontSize = false,
}: Readonly<{
    prefix: string;
    onChange: (style: React.CSSProperties) => void;
    isFontSize?: boolean;
}>) {
    const widgetRoundPercentageSettingName = `${prefix}-setting-show-widget-round-percentage`;
    const widgetWidthPercentageSettingName = `${prefix}-setting-show-widget-width-percentage`;
    const opacityPercentageSettingName = `${prefix}-setting-show-widget-opacity-percentage`;
    const alignmentSettingName = `${prefix}-setting-show-widget-alignment-data`;
    const offsetXSettingName = `${prefix}-setting-show-widget-offset-x`;
    const offsetYSettingName = `${prefix}-setting-show-widget-offset-y`;
    const fontSizeSettingName = `${prefix}-setting-show-widget-font-size`;
    const roundSizePixelSettingName = `${prefix}-setting-show-widget-round-size-px`;

    const genStyle = () => {
        return {
            position: 'absolute',
            height: 'auto',
            ...getWidgetRoundExtraStyle(
                roundSizePixelSettingName,
                widgetRoundPercentageSettingName,
            ),
            ...genWidgetWidthExtraStyle(widgetWidthPercentageSettingName),
            ...genWidgetOpacityExtraStyle(opacityPercentageSettingName),
            ...genAlignmentExtraStyle(
                alignmentSettingName,
                offsetXSettingName,
                offsetYSettingName,
            ),
            ...getFontSizeStyle(fontSizeSettingName),
        } as React.CSSProperties;
    };

    const onChange1 = () => {
        onChange(genStyle());
    };

    const [widgetOffsetX, setWidgetOffsetX] = useStateSettingNumber(
        offsetXSettingName,
        DEFAULT_WIDGET_OFFSET_X,
    );
    const setWidgetOffsetX1 = (value: number) => {
        setWidgetOffsetX(value);
        onChange1();
    };
    const [widgetOffsetY, setWidgetOffsetY] = useStateSettingNumber(
        offsetYSettingName,
        DEFAULT_WIDGET_OFFSET_Y,
    );
    const setWidgetOffsetY1 = (value: number) => {
        setWidgetOffsetY(value);
        onChange1();
    };

    const [roundPercentage, setRoundPercentage] = useStateSettingNumber(
        widgetRoundPercentageSettingName,
        DEFAULT_ROUND_PERCENTAGE,
    );
    const setRoundPercentage1 = (value: number) => {
        setRoundPercentage(value);
        onChange1();
    };
    const [widgetWidthPercentage, setWidgetWidthPercentage] =
        useStateSettingNumber(
            widgetWidthPercentageSettingName,
            DEFAULT_WIDGET_WIDTH_PERCENTAGE,
        );
    const setWidgetWidthPercentage1 = (value: number) => {
        setWidgetWidthPercentage(value);
        onChange1();
    };
    const [opacityPercentage, setOpacityPercentage] = useStateSettingNumber(
        opacityPercentageSettingName,
        DEFAULT_WIDGET_OPACITY_PERCENTAGE,
    );
    const setOpacityPercentage1 = (value: number) => {
        setOpacityPercentage(value);
        onChange1();
    };
    const [alignmentData, setAlignmentData] = useStateSettingString(
        alignmentSettingName,
        JSON.stringify({
            horizontalAlignment: 'center',
            verticalAlignment: 'center',
        }),
    );
    const setAlignmentData1 = (data: string) => {
        setAlignmentData(data);
        onChange1();
    };
    const [fontSize, setFontSize] = useStateSettingNumber(
        fontSizeSettingName,
        DEFAULT_FONT_SIZE,
    );
    const setFontSize1 = (value: number) => {
        setFontSize(value);
        onChange1();
    };
    const [roundSizePixel, setRoundSizePixel] = useStateSettingNumber(
        roundSizePixelSettingName,
        DEFAULT_ROUND_SIZE_PIXEL,
    );
    const setRoundSizePixel1 = (value: number) => {
        setRoundSizePixel(value);
        onChange1();
    };

    return {
        genStyle,
        element: (
            <PropertiesSettingComp
                alignmentData={alignmentData}
                setAlignmentData={setAlignmentData1}
                widgetWidthPercentage={widgetWidthPercentage}
                setWidgetWidthPercentage={setWidgetWidthPercentage1}
                opacityPercentage={opacityPercentage}
                setOpacityPercentage={setOpacityPercentage1}
                roundPercentage={roundPercentage}
                setRoundPercentage={setRoundPercentage1}
                widgetOffsetX={widgetOffsetX}
                setWidgetOffsetX={setWidgetOffsetX1}
                widgetOffsetY={widgetOffsetY}
                setWidgetOffsetY={setWidgetOffsetY1}
                isFontSize={isFontSize}
                fontSize={fontSize}
                setFontSize={setFontSize1}
                roundSizePixel={roundSizePixel}
                setRoundSizePixel={setRoundSizePixel1}
                target={prefix}
            />
        ),
    };
}
