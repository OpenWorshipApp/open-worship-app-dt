import {
    type ChangeEvent,
    type CSSProperties,
    useCallback,
    useRef,
} from 'react';

import { DEFAULT_LOCALE, tran } from '../lang/langHelpers';
import {
    useStateSettingNumber,
    useStateSettingString,
} from '../helper/settingHelpers';
import ScreenForegroundManager from '../_screen/managers/ScreenForegroundManager';
import { useScreenForegroundManagerEvents } from '../_screen/managers/screenEventHelpers';
import {
    getScreenForegroundManagerInstances,
    getForegroundShowingScreenIdDataList,
    getScreenForegroundManagerByDropped,
} from './foregroundHelpers';
import ScreensRendererComp from './ScreensRendererComp';
import ForegroundLayoutComp from './ForegroundLayoutComp';
import { useForegroundPropsSetting } from './propertiesSettingHelpers';
import type {
    ForegroundDataType,
    ForegroundMarqueeDataType,
    MarqueePositionType,
} from '../_screen/screenTypeHelpers';
import {
    DEFAULT_MARQUEE_SPEED_PERCENTAGE,
    MAX_MARQUEE_SPEED_PERCENTAGE,
    MIN_MARQUEE_SPEED_PERCENTAGE,
} from '../_screen/screenTypeHelpers';
import { dragStore } from '../helper/dragHelpers';
import { genTimeoutAttempt } from '../helper/timeoutHelpers';
import { useAppCurrentRef } from '../helper/appHooks';

const FONT_SIZE_PRESETS = [0, 50, 75, 100, 150];
const SPEED_PERCENTAGE_PRESETS = [50, 75, 100, 150, 200];

type MarqueeConfigType = {
    position: MarqueePositionType;
    target: string;
    label: string;
    showLabel: string;
    hideLabel: string;
    fontSizeLabel: string;
    speedLabel: string;
    dateButtonLabel: string;
    placeholder: string;
    textareaId: string;
    textSettingName: string;
    fontSizeSettingName: string;
    speedSettingName: string;
    defaultText: string;
    getData: (data: ForegroundDataType) => ForegroundMarqueeDataType | null;
    setData: (
        screenForegroundManager: ScreenForegroundManager,
        data: ForegroundMarqueeDataType | null,
    ) => void;
    show: (
        event: any,
        text: string | null,
        extraStyle: CSSProperties,
        speedPercentage: number,
        isForceChoosing: boolean,
    ) => void;
};

const CONFIG_MAP: Record<MarqueePositionType, MarqueeConfigType> = {
    top: {
        position: 'top',
        target: 'marquee-top',
        label: 'Marquee Top',
        showLabel: 'Show Marquee Top',
        hideLabel: 'Hide Marquee Top',
        fontSizeLabel: 'Marquee Top font size (0 = auto)',
        speedLabel: 'Marquee Top scroll speed (%)',
        dateButtonLabel: "Insert today's date as the marquee top text",
        placeholder: 'Leave a marquee top text here',
        textareaId: 'marquee-top-textarea',
        textSettingName: 'foreground-marquee-top-setting',
        fontSizeSettingName: 'foreground-marquee-top-font-size',
        speedSettingName: 'foreground-marquee-top-speed-percentage',
        defaultText:
            'This is a testing marquee top text. It has to be long enough to ' +
            'test the marquee top scrolling effect properly.',
        getData: (data) => data.marqueeTopData,
        setData: (screenForegroundManager, data) => {
            screenForegroundManager.setMarqueeTopData(data);
        },
        show: (event, text, extraStyle, speedPercentage, isForceChoosing) => {
            ScreenForegroundManager.setMarqueeTop(
                event,
                text,
                extraStyle,
                speedPercentage,
                isForceChoosing,
            );
        },
    },
    bottom: {
        position: 'bottom',
        target: 'marquee-bottom',
        label: 'Marquee Bottom',
        showLabel: 'Show Marquee Bottom',
        hideLabel: 'Hide Marquee Bottom',
        fontSizeLabel: 'Marquee Bottom font size (0 = auto)',
        speedLabel: 'Marquee Bottom scroll speed (%)',
        dateButtonLabel: "Insert today's date as the marquee bottom text",
        placeholder: 'Leave a marquee bottom text here',
        textareaId: 'marquee-bottom-textarea',
        textSettingName: 'foreground-marquee-bottom-setting',
        fontSizeSettingName: 'foreground-marquee-bottom-font-size',
        speedSettingName: 'foreground-marquee-bottom-speed-percentage',
        defaultText:
            'This is a testing marquee bottom text. It has to be long enough ' +
            'to test the marquee bottom scrolling effect properly.',
        getData: (data) => data.marqueeBottomData,
        setData: (screenForegroundManager, data) => {
            screenForegroundManager.setMarqueeBottomData(data);
        },
        show: (event, text, extraStyle, speedPercentage, isForceChoosing) => {
            ScreenForegroundManager.setMarqueeBottom(
                event,
                text,
                extraStyle,
                speedPercentage,
                isForceChoosing,
            );
        },
    },
};

function withFontSize(style: CSSProperties, fontSize: number): CSSProperties {
    return fontSize > 0 ? { ...style, fontSize: `${fontSize}px` } : style;
}

// One debouncer per position, otherwise a refresh on one marquee would cancel
// the other's pending refresh.
const attemptTimeoutMap: Record<
    MarqueePositionType,
    ReturnType<typeof genTimeoutAttempt>
> = {
    top: genTimeoutAttempt(500),
    bottom: genTimeoutAttempt(500),
};
function refreshAllMarquees(
    config: MarqueeConfigType,
    showingScreenIdDataList: [number, ForegroundMarqueeDataType][],
    extraStyle: CSSProperties,
    speedPercentage: number,
) {
    attemptTimeoutMap[config.position](() => {
        for (const [screenId, data] of showingScreenIdDataList) {
            getScreenForegroundManagerInstances(
                screenId,
                (screenForegroundManager) => {
                    config.setData(screenForegroundManager, {
                        ...data,
                        speedPercentage,
                        extraStyle,
                    });
                },
            );
        }
    });
}

export default function ForegroundMarqueeComp({
    position,
}: Readonly<{
    position: MarqueePositionType;
}>) {
    const config = CONFIG_MAP[position];
    useScreenForegroundManagerEvents(['update']);
    const [text, setText] = useStateSettingString<string>(
        config.textSettingName,
        config.defaultText,
    );
    const [fontSize, setFontSize] = useStateSettingNumber(
        config.fontSizeSettingName,
        0,
    );
    const [speedPercentage, setSpeedPercentage] = useStateSettingNumber(
        config.speedSettingName,
        DEFAULT_MARQUEE_SPEED_PERCENTAGE,
    );

    const showingScreenIdDataList = getForegroundShowingScreenIdDataList(
        (data) => {
            return config.getData(data) !== null;
        },
    )
        .map(([screenId, data]): [number, ForegroundMarqueeDataType] | null => {
            const marqueeData = config.getData(data);
            if (marqueeData === null) {
                return null;
            }
            return [screenId, marqueeData];
        })
        .filter((item) => {
            return item !== null;
        });

    // `genStyle` only exists after the props-setting hook runs, but the font
    // size and speed controls live inside that hook's `extraControls`. The ref
    // lets those controls push a live update to every showing marquee.
    const genStyleRef = useRef<() => CSSProperties>(() => ({}));
    const refreshShowing = (
        newFontSize: number,
        newSpeedPercentage: number,
    ) => {
        refreshAllMarquees(
            config,
            showingScreenIdDataList,
            withFontSize(genStyleRef.current(), newFontSize),
            newSpeedPercentage,
        );
    };
    const handleFontSizeSetting = (newFontSize: number) => {
        setFontSize(newFontSize);
        refreshShowing(newFontSize, speedPercentage);
    };
    const handleFontSizeChange = (event: ChangeEvent<HTMLInputElement>) => {
        handleFontSizeSetting(Number.parseInt(event.target.value) || 0);
    };
    const handleSpeedSetting = (newSpeedPercentage: number) => {
        setSpeedPercentage(newSpeedPercentage);
        refreshShowing(fontSize, newSpeedPercentage);
    };
    const handleSpeedChange = (event: ChangeEvent<HTMLInputElement>) => {
        handleSpeedSetting(
            Number.parseInt(event.target.value) ||
                DEFAULT_MARQUEE_SPEED_PERCENTAGE,
        );
    };

    const {
        genStyle,
        element: propsSetting,
        fontFamily,
        fontWeight,
    } = useForegroundPropsSetting({
        prefix: config.target,
        isGeometry: false,
        onChange: (extraStyle) => {
            refreshAllMarquees(
                config,
                showingScreenIdDataList,
                withFontSize(extraStyle, fontSize),
                speedPercentage,
            );
        },
        extraControls: (
            <>
                <div
                    className="d-flex input-group m-1"
                    style={{ width: '190px', height: '35px' }}
                    title={tran(config.fontSizeLabel)}
                >
                    <span className="input-group-text">
                        <i className="bi bi-fonts" />
                    </span>
                    <input
                        className="form-control form-control-sm"
                        type="number"
                        min="0"
                        value={fontSize}
                        placeholder={tran('auto')}
                        onChange={handleFontSizeChange}
                    />
                    <span className="input-group-text">px</span>
                </div>
                <div
                    className="btn-group btn-group-sm m-1"
                    role="group"
                    title={tran('Quick font size')}
                >
                    {FONT_SIZE_PRESETS.map((size) => {
                        return (
                            <button
                                key={size}
                                type="button"
                                className={
                                    'btn btn-outline-secondary' +
                                    (fontSize === size ? ' active' : '')
                                }
                                onClick={() => handleFontSizeSetting(size)}
                            >
                                {size === 0 ? tran('Auto') : size}
                            </button>
                        );
                    })}
                </div>
                <div
                    className="d-flex input-group m-1"
                    style={{ width: '190px', height: '35px' }}
                    title={tran(config.speedLabel)}
                >
                    <span className="input-group-text">
                        <i className="bi bi-speedometer2" />
                    </span>
                    <input
                        className="form-control form-control-sm"
                        type="number"
                        min={MIN_MARQUEE_SPEED_PERCENTAGE}
                        max={MAX_MARQUEE_SPEED_PERCENTAGE}
                        step="10"
                        value={speedPercentage}
                        onChange={handleSpeedChange}
                    />
                    <span className="input-group-text">%</span>
                </div>
                <div
                    className="btn-group btn-group-sm m-1"
                    role="group"
                    title={tran('Quick scroll speed')}
                >
                    {SPEED_PERCENTAGE_PRESETS.map((percentage) => {
                        return (
                            <button
                                key={percentage}
                                type="button"
                                className={
                                    'btn btn-outline-secondary' +
                                    (speedPercentage === percentage
                                        ? ' active'
                                        : '')
                                }
                                onClick={() => handleSpeedSetting(percentage)}
                            >
                                {percentage === DEFAULT_MARQUEE_SPEED_PERCENTAGE
                                    ? tran('Normal')
                                    : `${percentage}%`}
                            </button>
                        );
                    })}
                </div>
            </>
        ),
    });
    genStyleRef.current = genStyle;
    const genExtraStyle = useCallback((): CSSProperties => {
        return withFontSize(genStyle(), fontSize);
    }, [genStyle, fontSize]);
    const editorStyle: CSSProperties = {
        fontFamily: fontFamily || undefined,
        fontWeight: fontWeight && fontWeight !== '--' ? fontWeight : undefined,
        height: '150px',
    };

    const handleShowing = useCallback(
        (event: any, isForceChoosing = false) => {
            config.show(
                event,
                text,
                genExtraStyle(),
                speedPercentage,
                isForceChoosing,
            );
        },
        [config, text, genExtraStyle, speedPercentage],
    );
    const handleShowingRef = useAppCurrentRef(handleShowing);
    const handleContextMenuOpening = useCallback((event: any) => {
        handleShowingRef.current(event, true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleByDropped = useCallback(
        (event: any) => {
            const screenForegroundManager =
                getScreenForegroundManagerByDropped(event);
            if (screenForegroundManager === null) {
                return;
            }
            config.setData(screenForegroundManager, {
                text,
                speedPercentage,
                extraStyle: genExtraStyle(),
            });
        },
        [config, text, genExtraStyle, speedPercentage],
    );
    const handleHiding = useCallback(
        (screenId: number) => {
            getScreenForegroundManagerInstances(
                screenId,
                (screenForegroundManager) => {
                    config.setData(screenForegroundManager, null);
                },
            );
        },
        [config],
    );
    const genHidingElement = (isMini: boolean) => (
        <ScreensRendererComp
            showingScreenIdDataList={showingScreenIdDataList}
            buttonText={tran(config.hideLabel)}
            handleForegroundHiding={handleHiding}
            isMini={isMini}
        />
    );
    const setTextRef = useAppCurrentRef(setText);
    const handleDateSetting = useCallback(() => {
        const date = new Date();
        const formattedDate = date.toLocaleString(DEFAULT_LOCALE, {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
        setTextRef.current(formattedDate);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleTextChange = useCallback(
        (event: ChangeEvent<HTMLTextAreaElement>) => {
            setTextRef.current(event.target.value);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    const handleByDroppedRef = useAppCurrentRef(handleByDropped);
    const handleMarqueeDragStart = useCallback(() => {
        dragStore.onDropped = handleByDroppedRef.current;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleMarqueeDragEnd = useCallback(() => {
        dragStore.onDropped = null;
    }, []);
    return (
        <ForegroundLayoutComp
            target={config.target}
            fullChildHeaders={<h4>{tran(config.label)}</h4>}
            childHeadersOnHidden={genHidingElement(true)}
        >
            {propsSetting}
            <hr />
            <div className="d-flex flex-column gap-2">
                <div className="d-flex flex-wrap align-items-center gap-2">
                    <button
                        className="btn btn-sm btn-outline-info"
                        title={tran(config.dateButtonLabel)}
                        onClick={handleDateSetting}
                    >
                        <i className="bi bi-calendar-plus" />{' '}
                        {tran("Today's Date")}
                    </button>
                </div>
                <div className="form-floating">
                    <textarea
                        id={config.textareaId}
                        className="form-control"
                        cols={30}
                        rows={50}
                        value={text}
                        onChange={handleTextChange}
                        placeholder={config.placeholder}
                        style={editorStyle}
                    />
                    <label htmlFor={config.textareaId}>
                        {tran(config.label)}
                    </label>
                </div>
                <div className="d-flex">
                    <button
                        className="btn btn-primary"
                        title={tran(config.showLabel)}
                        onClick={handleShowing}
                        onContextMenu={handleContextMenuOpening}
                        draggable
                        onDragStart={handleMarqueeDragStart}
                        onDragEnd={handleMarqueeDragEnd}
                    >
                        <i className="bi bi-display" /> {tran(config.showLabel)}
                    </button>
                </div>
            </div>
            {genHidingElement(false)}
        </ForegroundLayoutComp>
    );
}
