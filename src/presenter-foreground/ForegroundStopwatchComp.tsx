import {
    useCallback,
    useMemo,
    type CSSProperties,
    type ReactNode,
} from 'react';

import ContextMenuDotsButtonComp from '../context-menu/ContextMenuDotsButtonComp';
import { tran } from '../lang/langHelpers';
import ScreenForegroundManager from '../_screen/managers/ScreenForegroundManager';
import {
    getScreenForegroundManagerInstances,
    getForegroundShowingScreenIdDataList,
    getScreenForegroundManagerByDropped,
} from './foregroundHelpers';
import ScreensRendererComp from './ScreensRendererComp';
import { useScreenForegroundManagerEvents } from '../_screen/managers/screenEventHelpers';
import { useForegroundPropsSetting } from './propertiesSettingHelpers';
import type { TransitionEffectType } from '../_screen/transitionEffectHelpers';
import { toTransitionPart } from '../_screen/transitionOverrideHelpers';
import {
    type ForegroundStopwatchDataType,
    withForegroundLayer,
} from '../_screen/screenTypeHelpers';
import ForegroundLayoutComp from './ForegroundLayoutComp';
import { dragStore, handleDragStart } from '../helper/dragHelpers';
import { genForegroundDragInf } from './foregroundDragHelpers';
import { genTimeoutAttempt } from '../helper/timeoutHelpers';
import { useAppCurrentRef } from '../helper/appHooks';
import {
    checkIsSessionData,
    toSessionShowingList,
    useForegroundSessions,
} from './foregroundSessionHelpers';
import {
    useStateSettingBoolean,
    useStateSettingString,
} from '../helper/settingHelpers';
import {
    genStopwatchTiming,
    getStopwatchState,
    toPausedStopwatchData,
    toResetStopwatchData,
    toStartedStopwatchData,
    toStopwatchElapsedMillisecond,
    toTimerClockText,
} from '../_screen/managers/timerStateHelpers';
import ForegroundTimerControlsComp, {
    ForegroundAutoStartSwitchComp,
} from './ForegroundTimerControlsComp';
import {
    addStopwatchHistoryEntry,
    genStopwatchHistorySettingName,
    parseStopwatchHistory,
    toStopwatchHistoryWhenText,
    type StopwatchHistoryEntryType,
} from './stopwatchHistoryHelpers';
import { showAppConfirm } from '../popup-widget/popupWidgetHelpers';

/** The keys a session of this panel owns beyond its Properties. */
function genOwnSettingNames(suffix: string) {
    return [
        `foreground-stopwatch-auto-start-setting${suffix}`,
        genStopwatchHistorySettingName(suffix),
    ];
}

function refreshAllStopwatches(
    showingScreenIds: [number, ForegroundStopwatchDataType][],
    extraStyle: CSSProperties,
    isBehind: boolean,
) {
    for (const [screenId, data] of showingScreenIds) {
        getScreenForegroundManagerInstances(
            screenId,
            (screenForegroundManager) => {
                screenForegroundManager.setStopwatchData(null);
                screenForegroundManager.setStopwatchData(
                    withForegroundLayer({ ...data, extraStyle }, isBehind),
                );
            },
        );
    }
}

function handleHiding(screenId: number) {
    getScreenForegroundManagerInstances(screenId, (screenForegroundManager) => {
        screenForegroundManager.setStopwatchData(null);
    });
}

/** See the countdown panel's `applyToCountdowns`. */
function applyToStopwatches(
    showingList: [number, ForegroundStopwatchDataType][],
    toNewData: (
        data: ForegroundStopwatchDataType,
        now: number,
    ) => ForegroundStopwatchDataType,
) {
    const now = Date.now();
    for (const [screenId, data] of showingList) {
        getScreenForegroundManagerInstances(
            screenId,
            (screenForegroundManager) => {
                screenForegroundManager.setStopwatchData(toNewData(data, now));
            },
        );
    }
}

/**
 * The Show / Start button and its Auto-start switch. Keyed by the session in
 * the panel, because the switch reads its setting once, when it mounts.
 */
function StopwatchShowingComp({
    genStyle,
    getIsBehind,
    getTransition,
    sessionId,
    suffix,
    children,
}: Readonly<{
    genStyle: () => CSSProperties;
    getIsBehind: () => boolean;
    /** This session's own transition, else the component's -- or none. */
    getTransition: () => TransitionEffectType | undefined;
    sessionId: string;
    suffix: string;
    children: ReactNode;
}>) {
    // Off by default: the stopwatch goes up on zero and waits for Start.
    const [isAutoStart, setIsAutoStart] = useStateSettingBoolean(
        `foreground-stopwatch-auto-start-setting${suffix}`,
        false,
    );
    const handleShowing = useCallback(
        (event: any, isForceChoosing = false) => {
            ScreenForegroundManager.setStopwatch(
                event,
                genStopwatchTiming(isAutoStart),
                genStyle(),
                isForceChoosing,
                sessionId,
                getIsBehind(),
                getTransition(),
            );
        },
        [genStyle, getIsBehind, getTransition, sessionId, isAutoStart],
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
            screenForegroundManager.setStopwatchData(
                withForegroundLayer(
                    {
                        // The session rides a LIVE drop from this panel,
                        // which is this session acting. A run-sheet row
                        // replayed weeks later carries none -- see
                        // `applyForegroundDragData`.
                        id: sessionId || undefined,
                        ...toTransitionPart(getTransition()),
                        ...genStopwatchTiming(isAutoStart),
                        extraStyle: genStyle(),
                    },
                    getIsBehind(),
                ),
            );
        },
        [genStyle, getIsBehind, getTransition, sessionId, isAutoStart],
    );
    const handleByDroppedRef = useAppCurrentRef(handleByDropped);
    const genStyleRef = useAppCurrentRef(genStyle);
    const getIsBehindRef = useAppCurrentRef(getIsBehind);
    const getTransitionRef = useAppCurrentRef(getTransition);
    const isAutoStartRef = useAppCurrentRef(isAutoStart);
    const handleDraggingStart = useCallback((event: any) => {
        dragStore.onDropped = handleByDroppedRef.current;
        handleDragStart(
            event,
            genForegroundDragInf('stopwatch', () => {
                return withForegroundLayer(
                    {
                        ...toTransitionPart(getTransitionRef.current()),
                        isAutoStart: isAutoStartRef.current,
                        extraStyle: genStyleRef.current(),
                    },
                    getIsBehindRef.current(),
                );
            }),
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const showingLabel = isAutoStart
        ? tran('Start Stopwatch')
        : tran('Show Stopwatch');
    return (
        <>
            <div className="fg-fields">
                <ForegroundAutoStartSwitchComp
                    isAutoStart={isAutoStart}
                    setIsAutoStart={setIsAutoStart}
                />
            </div>
            <div className="fg-actions">
                <button
                    className="btn btn-primary"
                    title={showingLabel}
                    onClick={handleShowing}
                    onContextMenu={handleContextMenuOpening}
                    draggable
                    onDragStart={handleDraggingStart}
                >
                    <i
                        className={`bi ${isAutoStart ? 'bi-play-fill' : 'bi-display'}`}
                    />{' '}
                    {showingLabel}
                </button>
                <ContextMenuDotsButtonComp
                    label={tran('Show on Screens')}
                    onOpening={handleContextMenuOpening}
                />
                {children}
            </div>
        </>
    );
}

/** The times this session was reset from, newest first. */
function StopwatchHistoryComp({
    historyList,
    onClear,
}: Readonly<{
    historyList: StopwatchHistoryEntryType[];
    onClear: () => void;
}>) {
    if (historyList.length === 0) {
        return null;
    }
    const now = Date.now();
    return (
        <div className="fg-group">
            <div className="fg-history-head">
                <span className="fg-group-name">
                    <i className="bi bi-clock-history" />
                    <span>{tran('History')}</span>
                </span>
                <button
                    type="button"
                    className="fg-quiet-btn"
                    title={tran('Clear stopwatch history')}
                    onClick={onClear}
                >
                    <i className="bi bi-x-lg" />
                    <span>{tran('Clear')}</span>
                </button>
            </div>
            <ol className="fg-history">
                {historyList.map((entry, index) => {
                    return (
                        <li key={`${entry.endedAt}-${index}`}>
                            <span className="fg-history-number">
                                {historyList.length - index}
                            </span>
                            <span className="fg-history-time">
                                {toTimerClockText(
                                    Math.floor(entry.elapsedMillisecond / 1000),
                                )}
                            </span>
                            <span className="fg-history-when">
                                {toStopwatchHistoryWhenText(entry.endedAt, now)}
                            </span>
                        </li>
                    );
                })}
            </ol>
        </div>
    );
}

/**
 * Start / Pause / Resume / Reset for this session's stopwatch, and the times
 * Reset has saved. Keyed by the session in the panel: the history reads its
 * setting once, when it mounts.
 */
function StopwatchTimerComp({
    suffix,
    sessionShowingList,
}: Readonly<{
    suffix: string;
    sessionShowingList: [number, ForegroundStopwatchDataType][];
}>) {
    const [historyText, setHistoryText] = useStateSettingString<string>(
        genStopwatchHistorySettingName(suffix),
        '',
    );
    const historyList = useMemo(() => {
        return parseStopwatchHistory(historyText);
    }, [historyText]);
    const historyListRef = useAppCurrentRef(historyList);
    const setHistoryTextRef = useAppCurrentRef(setHistoryText);
    const sessionShowingRef = useAppCurrentRef(sessionShowingList);
    const controlState =
        sessionShowingList.length > 0
            ? getStopwatchState(sessionShowingList[0][1])
            : 'fixed';
    const handleTimerStarting = useCallback(() => {
        applyToStopwatches(sessionShowingRef.current, toStartedStopwatchData);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleTimerPausing = useCallback(() => {
        applyToStopwatches(sessionShowingRef.current, toPausedStopwatchData);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleTimerResetting = useCallback(() => {
        const showingList = sessionShowingRef.current;
        if (showingList.length > 0) {
            // Read off the same moment the reset uses, so the saved time is
            // exactly what the screen read when the button was pressed.
            const now = Date.now();
            const newList = addStopwatchHistoryEntry(historyListRef.current, {
                elapsedMillisecond: toStopwatchElapsedMillisecond(
                    showingList[0][1],
                    now,
                ),
                endedAt: now,
            });
            if (newList !== historyListRef.current) {
                setHistoryTextRef.current(JSON.stringify(newList));
            }
        }
        applyToStopwatches(showingList, toResetStopwatchData);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleHistoryClearing = useCallback(async () => {
        const isConfirmed = await showAppConfirm(
            tran('Clear stopwatch history'),
            tran('Remove the saved times of this session?'),
            { confirmButtonLabel: 'Clear' },
        );
        if (isConfirmed) {
            setHistoryTextRef.current('');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        <>
            {controlState !== 'fixed' ? (
                <ForegroundTimerControlsComp
                    state={controlState}
                    resetTitle={tran('Reset to zero and save the time')}
                    onStart={handleTimerStarting}
                    onPause={handleTimerPausing}
                    onReset={handleTimerResetting}
                />
            ) : null}
            <StopwatchHistoryComp
                historyList={historyList}
                onClear={handleHistoryClearing}
            />
        </>
    );
}

export default function ForegroundStopwatchComp() {
    useScreenForegroundManagerEvents(['update']);
    // Per-instance, not module-level: nothing here may assume this panel stays
    // a single mount for good -- that assumption is what left only one stage
    // refreshing in `useVarySlidesData`.
    const attemptTimeout = useMemo(() => {
        return genTimeoutAttempt(500);
    }, []);
    const showingScreenIdDataList = getForegroundShowingScreenIdDataList(
        (data) => {
            return data.stopwatchData !== null;
        },
    )
        .map(
            ([screenId, data]):
                [number, ForegroundStopwatchDataType] | null => {
                if (data.stopwatchData === null) {
                    return null;
                }
                return [screenId, data.stopwatchData];
            },
        )
        .filter((item) => {
            return item !== null;
        });
    const showingRef = useAppCurrentRef(showingScreenIdDataList);
    // A stopwatch is ONE thing on the screen, so a session here is a saved
    // LOOK -- its own size, place and colours -- for the one a service
    // actually needs: the big centred timer for the countdown to the start,
    // the small corner one behind a testimony.
    const {
        activeId,
        sessionIds,
        suffix,
        prefix,
        element: sessionsElement,
    } = useForegroundSessions({
        widgetKey: 'stopwatch',
        toPrefix: (sessionSuffix) => {
            return `stopwatch${sessionSuffix}`;
        },
        toOwnSettingNames: genOwnSettingNames,
        checkIsOnScreen: (sessionId, _suffix, idList) => {
            return showingScreenIdDataList.some(([, data]) => {
                return checkIsSessionData(data, sessionId, idList);
            });
        },
        hideSession: (sessionId, _suffix, idList) => {
            for (const [screenId, data] of showingRef.current) {
                if (checkIsSessionData(data, sessionId, idList)) {
                    handleHiding(screenId);
                }
            }
        },
    });
    // The Hide row is THIS session's too -- see `toSessionShowingList`.
    const sessionShowingList = toSessionShowingList(
        showingScreenIdDataList,
        activeId,
        sessionIds,
    );
    const {
        genStyle,
        getIsBehind,
        getTransition,
        element: propsSetting,
    } = useForegroundPropsSetting({
        prefix,
        widgetKey: 'stopwatch',
        onChange: (extraStyle, isBehind) => {
            attemptTimeout(() => {
                // THIS session's stopwatch only. `activeId` is read from the
                // render the control was touched in, not at fire time: the
                // change belongs to the session it was made on even if the
                // strip is switched inside the half-second.
                refreshAllStopwatches(
                    toSessionShowingList(
                        showingRef.current,
                        activeId,
                        sessionIds,
                    ),
                    extraStyle,
                    isBehind,
                );
            });
        },
        isFontSize: true,
    });
    const genHidingElement = (isMini: boolean) => (
        <ScreensRendererComp
            showingScreenIdDataList={sessionShowingList}
            buttonText={tran('Hide Stopwatch')}
            handleForegroundHiding={handleHiding}
            isMini={isMini}
        />
    );
    return (
        <ForegroundLayoutComp target="stopwatch">
            {sessionsElement}
            {propsSetting}
            <div className="fg-body">
                {/*
                 * The caption stays, the card around it goes: this panel has
                 * exactly one thing to say and one button to press, and a
                 * border inside a bordered panel said neither.
                 */}
                <span className="fg-group-name">
                    <i className="bi bi-stopwatch" />
                    <span>{tran('Count up from zero')}</span>
                </span>
                <StopwatchShowingComp
                    key={activeId}
                    genStyle={genStyle}
                    getIsBehind={getIsBehind}
                    getTransition={getTransition}
                    sessionId={activeId}
                    suffix={suffix}
                >
                    {genHidingElement(false)}
                </StopwatchShowingComp>
                <StopwatchTimerComp
                    key={`timer-${activeId}`}
                    suffix={suffix}
                    sessionShowingList={sessionShowingList}
                />
            </div>
        </ForegroundLayoutComp>
    );
}
