import ContextMenuDotsButtonComp from '../context-menu/ContextMenuDotsButtonComp';
import {
    type ChangeEvent,
    type CSSProperties,
    useCallback,
    useMemo,
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
import PropRowComp, { PropChipsComp } from './ForegroundPropRowComp';
import SavedTextSessionButtonsComp from './SavedTextSessionButtonsComp';
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
import { dragStore, handleDragStart } from '../helper/dragHelpers';
import { genForegroundDragInf } from './foregroundDragHelpers';
import { genTimeoutAttempt } from '../helper/timeoutHelpers';
import { useAppCurrentRef } from '../helper/appHooks';
import {
    checkIsSessionData,
    toSessionShowingList,
    useForegroundSessions,
} from './foregroundSessionHelpers';

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
    savedSessionListSettingName: string;
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
        sessionId: string,
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
        savedSessionListSettingName: 'foreground-marquee-top-saved-sessions',
        defaultText:
            'This is a testing marquee top text. It has to be long enough to ' +
            'test the marquee top scrolling effect properly.',
        getData: (data) => data.marqueeTopData,
        setData: (screenForegroundManager, data) => {
            screenForegroundManager.setMarqueeTopData(data);
        },
        show: (
            event,
            text,
            extraStyle,
            speedPercentage,
            isForceChoosing,
            sessionId,
        ) => {
            ScreenForegroundManager.setMarqueeTop(
                event,
                text,
                extraStyle,
                speedPercentage,
                isForceChoosing,
                sessionId,
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
        savedSessionListSettingName: 'foreground-marquee-bottom-saved-sessions',
        defaultText:
            'This is a testing marquee bottom text. It has to be long enough ' +
            'to test the marquee bottom scrolling effect properly.',
        getData: (data) => data.marqueeBottomData,
        setData: (screenForegroundManager, data) => {
            screenForegroundManager.setMarqueeBottomData(data);
        },
        show: (
            event,
            text,
            extraStyle,
            speedPercentage,
            isForceChoosing,
            sessionId,
        ) => {
            ScreenForegroundManager.setMarqueeBottom(
                event,
                text,
                extraStyle,
                speedPercentage,
                isForceChoosing,
                sessionId,
            );
        },
    },
};

function withFontSize(style: CSSProperties, fontSize: number): CSSProperties {
    return fontSize > 0 ? { ...style, fontSize: `${fontSize}px` } : style;
}

/** The keys ONE session of a marquee owns beyond its Properties. */
function genOwnSettingNames(config: MarqueeConfigType, suffix: string) {
    return [
        `${config.textSettingName}${suffix}`,
        `${config.fontSizeSettingName}${suffix}`,
        `${config.speedSettingName}${suffix}`,
    ];
}

function refreshAllMarquees(
    config: MarqueeConfigType,
    showingScreenIdDataList: [number, ForegroundMarqueeDataType][],
    extraStyle: CSSProperties,
    speedPercentage: number,
) {
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
}

/**
 * The panel, ON ONE SESSION. Every field reads its setting when it mounts,
 * so the wrapper underneath keys this by the session -- otherwise switching
 * would leave the previous session's words in the box while writing them to
 * the new session's keys.
 */
function MarqueeBodyComp({
    config,
    sessionId,
    suffix,
    prefix,
}: Readonly<{
    config: MarqueeConfigType;
    sessionId: string;
    suffix: string;
    prefix: string;
}>) {
    // Per-instance: nothing here may assume this panel stays a single mount,
    // and a shared one would drop the other marquee's pending refresh.
    const attemptTimeout = useMemo(() => {
        return genTimeoutAttempt(500);
    }, []);
    const [text, setText] = useStateSettingString<string>(
        `${config.textSettingName}${suffix}`,
        config.defaultText,
    );
    const [fontSize, setFontSize] = useStateSettingNumber(
        `${config.fontSizeSettingName}${suffix}`,
        0,
    );
    const [speedPercentage, setSpeedPercentage] = useStateSettingNumber(
        `${config.speedSettingName}${suffix}`,
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
    const showingRef = useAppCurrentRef(showingScreenIdDataList);
    // THIS session's marquee only. The panel lists every marquee of its
    // position so the Hide row can always reach one, but a style belongs to
    // the session it was set on -- see `toSessionShowingList`.
    const getSessionShowing = () => {
        return toSessionShowingList(showingRef.current, sessionId);
    };
    const refreshShowing = (
        newFontSize: number,
        newSpeedPercentage: number,
    ) => {
        attemptTimeout(() => {
            refreshAllMarquees(
                config,
                getSessionShowing(),
                withFontSize(genStyleRef.current(), newFontSize),
                newSpeedPercentage,
            );
        });
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
        prefix,
        isGeometry: false,
        onChange: (extraStyle) => {
            attemptTimeout(() => {
                refreshAllMarquees(
                    config,
                    getSessionShowing(),
                    withFontSize(extraStyle, fontSize),
                    speedPercentage,
                );
            });
        },
        extraControls: (
            <>
                <PropRowComp
                    iconClassName="bi bi-fonts"
                    label={tran('Font Size')}
                    title={tran(config.fontSizeLabel)}
                    isEngaged={fontSize !== 0}
                >
                    <PropChipsComp
                        label={tran('Quick font size')}
                        values={FONT_SIZE_PRESETS}
                        value={fontSize}
                        setValue={handleFontSizeSetting}
                        zeroLabel={tran('Auto')}
                    />
                    <input
                        className="fg-num"
                        type="number"
                        min="0"
                        aria-label={tran(config.fontSizeLabel)}
                        placeholder={tran('auto')}
                        value={fontSize}
                        onChange={handleFontSizeChange}
                    />
                    <span className="fg-unit-static">px</span>
                </PropRowComp>
                <PropRowComp
                    iconClassName="bi bi-speedometer2"
                    label={tran('Speed')}
                    title={tran(config.speedLabel)}
                    isEngaged={
                        speedPercentage !== DEFAULT_MARQUEE_SPEED_PERCENTAGE
                    }
                >
                    <PropChipsComp
                        label={tran('Quick scroll speed')}
                        values={SPEED_PERCENTAGE_PRESETS}
                        value={speedPercentage}
                        setValue={handleSpeedSetting}
                    />
                    <input
                        className="fg-num"
                        type="number"
                        min={MIN_MARQUEE_SPEED_PERCENTAGE}
                        max={MAX_MARQUEE_SPEED_PERCENTAGE}
                        step="10"
                        aria-label={tran(config.speedLabel)}
                        value={speedPercentage}
                        onChange={handleSpeedChange}
                    />
                    <span className="fg-unit-static">%</span>
                </PropRowComp>
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
        // A marquee is ONE scrolling line, and 150px of box for it was 66px
        // of a floating panel that also has to show the file grid. The box
        // resizes by its own corner for anyone who wants more.
        height: '84px',
    };

    const handleShowing = useCallback(
        (event: any, isForceChoosing = false) => {
            config.show(
                event,
                text,
                genExtraStyle(),
                speedPercentage,
                isForceChoosing,
                sessionId,
            );
        },
        [config, text, genExtraStyle, speedPercentage, sessionId],
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
                // A LIVE drop from this panel is this session acting; a
                // run-sheet row replayed weeks later carries none.
                id: sessionId || undefined,
                text,
                speedPercentage,
                extraStyle: genExtraStyle(),
            });
        },
        [config, text, genExtraStyle, speedPercentage, sessionId],
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
    const textRef = useAppCurrentRef(text);
    const speedPercentageRef = useAppCurrentRef(speedPercentage);
    const genExtraStyleRef = useAppCurrentRef(genExtraStyle);
    const configRef = useAppCurrentRef(config);
    const handleMarqueeDragStart = useCallback((event: any) => {
        dragStore.onDropped = handleByDroppedRef.current;
        handleDragStart(
            event,
            genForegroundDragInf(
                configRef.current.target as 'marquee-top' | 'marquee-bottom',
                () => {
                    return {
                        text: textRef.current,
                        speedPercentage: speedPercentageRef.current,
                        extraStyle: genExtraStyleRef.current(),
                    };
                },
            ),
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleMarqueeDragEnd = useCallback(() => {
        dragStore.onDropped = null;
    }, []);
    return (
        <>
            {propsSetting}
            <div className="fg-body">
                <div className="d-flex flex-wrap align-items-center gap-2">
                    <button
                        type="button"
                        className="fg-quiet-btn"
                        title={tran(config.dateButtonLabel)}
                        onClick={handleDateSetting}
                    >
                        <i className="bi bi-calendar-plus" />
                        <span>{tran("Today's Date")}</span>
                    </button>
                    <div className="ms-auto d-flex gap-2">
                        <SavedTextSessionButtonsComp
                            settingName={config.savedSessionListSettingName}
                            label={config.label}
                            text={text}
                            onPickText={setText}
                        />
                    </div>
                </div>
                {/*
                 * No floating label: it repeated the panel's own title bar,
                 * and Bootstrap's floating shell reserves a row of height to
                 * hold the word. The box is still named for anything reading
                 * by words, and the placeholder says what to type.
                 */}
                <textarea
                    id={config.textareaId}
                    className="fg-text-editor"
                    aria-label={tran(config.label)}
                    value={text}
                    onChange={handleTextChange}
                    placeholder={tran(config.placeholder)}
                    style={editorStyle}
                />
                {/*
                 * The take row: the one solid control in the panel, and --
                 * right beside it rather than in a bordered box below -- what
                 * it already put on a screen.
                 */}
                <div className="fg-actions">
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
                    <ContextMenuDotsButtonComp
                        label={tran('Show on Screens')}
                        onOpening={handleContextMenuOpening}
                    />
                    {genHidingElement(false)}
                </div>
            </div>
        </>
    );
}

export default function ForegroundMarqueeComp({
    position,
}: Readonly<{
    position: MarqueePositionType;
}>) {
    const config = CONFIG_MAP[position];
    useScreenForegroundManagerEvents(['update']);
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
    const showingRef = useAppCurrentRef(showingScreenIdDataList);
    // One session is one scroll ready to go -- the standing welcome in one,
    // this morning's car-park notice in another -- each with its own words,
    // its own speed and its own look.
    const {
        activeId,
        suffix,
        prefix,
        element: sessionsElement,
    } = useForegroundSessions({
        widgetKey: config.target,
        toPrefix: (sessionSuffix) => {
            return `${config.target}${sessionSuffix}`;
        },
        toOwnSettingNames: genOwnSettingNames.bind(null, config),
        checkIsOnScreen: (sessionId) => {
            return showingScreenIdDataList.some(([, data]) => {
                return checkIsSessionData(data, sessionId);
            });
        },
        hideSession: (sessionId) => {
            for (const [screenId, data] of showingRef.current) {
                if (!checkIsSessionData(data, sessionId)) {
                    continue;
                }
                getScreenForegroundManagerInstances(
                    screenId,
                    (screenForegroundManager) => {
                        config.setData(screenForegroundManager, null);
                    },
                );
            }
        },
    });
    return (
        <ForegroundLayoutComp target={config.target}>
            {sessionsElement}
            <MarqueeBodyComp
                key={activeId}
                config={config}
                sessionId={activeId}
                suffix={suffix}
                prefix={prefix}
            />
        </ForegroundLayoutComp>
    );
}
