import { type ChangeEvent, type CSSProperties } from 'react';
import { useCallback, useMemo } from 'react';

import ContextMenuDotsButtonComp from '../context-menu/ContextMenuDotsButtonComp';
import { tran } from '../lang/langHelpers';
import {
    useStateSettingBoolean,
    useStateSettingString,
} from '../helper/settingHelpers';
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
    type ForegroundCountdownDataType,
    withForegroundLayer,
} from '../_screen/screenTypeHelpers';
import ForegroundLayoutComp from './ForegroundLayoutComp';
import { dragStore, handleDragStart } from '../helper/dragHelpers';
import {
    COUNTDOWN_LEAD_SECOND,
    genForegroundDragInf,
} from './foregroundDragHelpers';
import { genTimeoutAttempt } from '../helper/timeoutHelpers';
import { useAppCurrentRef } from '../helper/appHooks';
import { showSimpleToast } from '../toast/toastHelpers';
import {
    checkIsSessionData,
    toSessionShowingList,
    useForegroundSessions,
} from './foregroundSessionHelpers';
import {
    genCountdownTiming,
    getCountdownState,
    toPausedCountdownData,
    toResetCountdownData,
    toStartedCountdownData,
} from '../_screen/managers/timerStateHelpers';
import ForegroundTimerControlsComp, {
    ForegroundAutoStartSwitchComp,
} from './ForegroundTimerControlsComp';

type CountdownTimingType = Pick<
    ForegroundCountdownDataType,
    'dateTime' | 'durationMillisecond' | 'pausedMillisecond'
>;

/**
 * The keys ONE session of this panel owns beyond its Properties -- the target
 * date and time of the first form, the hours, minutes and seconds of the
 * second and whether it starts the moment it is shown.
 *
 * Their names are the ones this widget has always written (`foreground-date`,
 * not `foreground-countdown-date`), because the Default session's suffix is
 * the empty string and renaming them would lose every countdown already set
 * up. Session 2 writes the same names with `-<id>` after them.
 */
function genOwnSettingNames(suffix: string) {
    return [
        `foreground-date-setting${suffix}`,
        `foreground-time-setting${suffix}`,
        `foreground-hours-setting${suffix}`,
        `foreground-minutes-setting${suffix}`,
        `foreground-seconds-setting${suffix}`,
        `foreground-countdown-auto-start-setting${suffix}`,
    ];
}

/** A box's whole number; an emptied, negative or unreadable box counts as 0. */
function toWholeNumber(value: string) {
    const number = Number.parseInt(value);
    return Number.isFinite(number) && number > 0 ? number : 0;
}

function useTiming(suffix: string) {
    const nowArray = () => {
        const date = new Date();
        const localISOString = date.toISOString();
        const iosDate = new Date(localISOString);
        iosDate.setMinutes(iosDate.getMinutes() - iosDate.getTimezoneOffset());
        return iosDate.toISOString().split('T');
    };
    const todayString = () => {
        return nowArray()[0];
    };
    const nowString = () => {
        const timeStr = nowArray()[1];
        return timeStr.substring(0, timeStr.lastIndexOf(':'));
    };
    const [date, setDate] = useStateSettingString<string>(
        `foreground-date-setting${suffix}`,
        todayString(),
    );
    const [time, setTime] = useStateSettingString<string>(
        `foreground-time-setting${suffix}`,
        nowString(),
    );
    return { date, setDate, time, setTime, nowString, todayString };
}

// `genTiming` is asked at the DROP, not when the drag began, so a countdown
// that starts as it lands has not already lost the seconds spent dragging.
const handleByDropped = (
    sessionId: string,
    genTiming: () => CountdownTimingType,
    extraStyle: CSSProperties,
    isBehind: boolean,
    transitionEffect: TransitionEffectType | undefined,
    event: any,
) => {
    const screenForegroundManager = getScreenForegroundManagerByDropped(event);
    if (screenForegroundManager === null) {
        return;
    }
    screenForegroundManager.setCountdownData(
        withForegroundLayer(
            {
                // A LIVE drop from this panel is this session acting; a
                // run-sheet row replayed weeks later carries none -- see
                // `applyForegroundDragData`.
                id: sessionId || undefined,
                ...toTransitionPart(transitionEffect),
                ...genTiming(),
                extraStyle,
            },
            isBehind,
        ),
    );
};

/**
 * The picker remembers its last date and time, so it reopens on yesterday's
 * target, and starting that put a red `00:00:00` on the projector with no
 * word to the operator. A past target is refused with a sentence instead --
 * the same rule `owa_foreground` already kept for a past `at`.
 */
function checkIsPastTargetWithMessage(targetDateTime: Date) {
    const time = targetDateTime.getTime();
    if (Number.isFinite(time) && time > Date.now()) {
        return false;
    }
    showSimpleToast(
        tran('That date and time has already passed'),
        tran('Pick a date and time later than now, or press Reset.'),
    );
    return true;
}

function CountDownOnDatetimeComp({
    genStyle,
    getIsBehind,
    getTransition,
    sessionId,
    suffix,
}: Readonly<{
    genStyle: () => CSSProperties;
    getIsBehind: () => boolean;
    /** This session's own transition, else the component's -- or none. */
    getTransition: () => TransitionEffectType | undefined;
    sessionId: string;
    suffix: string;
}>) {
    const { date, setDate, time, setTime, nowString, todayString } =
        useTiming(suffix);
    const getTargetDateTime = useCallback(() => {
        return new Date(date + ' ' + time);
    }, [date, time]);
    const handleDateTimeShowing = useCallback(
        (event: any, isForceChoosing = false) => {
            if (checkIsPastTargetWithMessage(getTargetDateTime())) {
                return;
            }
            ScreenForegroundManager.setCountdown(
                event,
                getTargetDateTime(),
                genStyle(),
                isForceChoosing,
                sessionId,
                getIsBehind(),
                getTransition(),
            );
        },
        [getTargetDateTime, genStyle, getIsBehind, getTransition, sessionId],
    );
    const setDateRef = useAppCurrentRef(setDate);
    const setTimeRef = useAppCurrentRef(setTime);
    const todayStringRef = useAppCurrentRef(todayString);
    const nowStringRef = useAppCurrentRef(nowString);
    const handleResetting = useCallback(() => {
        setDateRef.current(todayStringRef.current());
        setTimeRef.current(nowStringRef.current());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleDateTimeShowingRef = useAppCurrentRef(handleDateTimeShowing);
    const handleContextMenuOpening = useCallback((event: any) => {
        handleDateTimeShowingRef.current(event, true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleDateChange = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => {
            setDateRef.current(event.target.value);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    const handleTimeChange = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => {
            setTimeRef.current(event.target.value);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    const getTargetDateTimeRef = useAppCurrentRef(getTargetDateTime);
    const genStyleRef = useAppCurrentRef(genStyle);
    const getIsBehindRef = useAppCurrentRef(getIsBehind);
    const getTransitionRef = useAppCurrentRef(getTransition);
    const sessionIdRef = useAppCurrentRef(sessionId);
    const handleDraggingStart = useCallback((event: any) => {
        const targetDateTime = getTargetDateTimeRef.current();
        if (checkIsPastTargetWithMessage(targetDateTime)) {
            event.preventDefault();
            return;
        }
        const extraStyle = genStyleRef.current();
        const isBehind = getIsBehindRef.current();
        const transitionEffect = getTransitionRef.current();
        dragStore.onDropped = handleByDropped.bind(
            null,
            sessionIdRef.current,
            () => {
                return { dateTime: targetDateTime };
            },
            extraStyle,
            isBehind,
            transitionEffect,
        );
        handleDragStart(
            event,
            genForegroundDragInf('countdown', () => {
                return withForegroundLayer(
                    {
                        ...toTransitionPart(transitionEffect),
                        dateTime: targetDateTime.toJSON(),
                        extraStyle,
                    },
                    isBehind,
                );
            }),
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        <div className="fg-group">
            <span className="fg-group-name">
                <i className="bi bi-calendar-event" />
                <span>{tran('Count down to a specific date & time')}</span>
            </span>
            <div className="fg-fields">
                <label className="fg-field" title={tran('Countdown Date')}>
                    <i className="bi bi-calendar3" />
                    <input
                        type="date"
                        aria-label={tran('Countdown Date')}
                        value={date}
                        onChange={handleDateChange}
                        min={todayString()}
                    />
                </label>
                <label className="fg-field" title={tran('Countdown Time')}>
                    <i className="bi bi-clock" />
                    <input
                        type="time"
                        aria-label={tran('Countdown Time')}
                        value={time}
                        onChange={handleTimeChange}
                        min={nowString()}
                    />
                </label>
                <button
                    type="button"
                    title={tran('Reset Date and Time to Now')}
                    className="fg-quiet-btn"
                    onClick={handleResetting}
                >
                    <i className="bi bi-arrow-counterclockwise" />
                    <span>{tran('Reset')}</span>
                </button>
            </div>
            <div className="fg-actions">
                <button
                    className="btn btn-primary"
                    title={tran('Start Countdown to DateTime')}
                    onClick={handleDateTimeShowing}
                    onContextMenu={handleContextMenuOpening}
                    draggable
                    onDragStart={handleDraggingStart}
                >
                    <i className="bi bi-play-fill" />{' '}
                    {tran('Start Countdown to DateTime')}
                </button>
                <ContextMenuDotsButtonComp
                    label={tran('Show on Screens')}
                    onOpening={handleContextMenuOpening}
                />
            </div>
        </div>
    );
}

function CountDownInSetComp({
    genStyle,
    getIsBehind,
    getTransition,
    sessionId,
    suffix,
}: Readonly<{
    genStyle: () => CSSProperties;
    getIsBehind: () => boolean;
    /** This session's own transition, else the component's -- or none. */
    getTransition: () => TransitionEffectType | undefined;
    sessionId: string;
    suffix: string;
}>) {
    const [hours, setHours] = useStateSettingString<string>(
        `foreground-hours-setting${suffix}`,
        '0',
    );
    const [minutes, setMinutes] = useStateSettingString<string>(
        `foreground-minutes-setting${suffix}`,
        '5',
    );
    const [seconds, setSeconds] = useStateSettingString<string>(
        `foreground-seconds-setting${suffix}`,
        '0',
    );
    // Off by default: a countdown goes up on its full length and waits for
    // Start, so it can be put up ahead of time and started on the cue.
    const [isAutoStart, setIsAutoStart] = useStateSettingBoolean(
        `foreground-countdown-auto-start-setting${suffix}`,
        false,
    );
    const getDurationSecond = useCallback(() => {
        return (
            toWholeNumber(seconds) +
            60 * toWholeNumber(minutes) +
            3600 * toWholeNumber(hours)
        );
    }, [seconds, minutes, hours]);
    const genTiming = useCallback(() => {
        return genCountdownTiming(getDurationSecond(), isAutoStart);
    }, [getDurationSecond, isAutoStart]);
    const handleShowing = useCallback(
        (event: any, isForceChoosing = false) => {
            ScreenForegroundManager.setCountdown(
                event,
                genTiming(),
                genStyle(),
                isForceChoosing,
                sessionId,
                getIsBehind(),
                getTransition(),
            );
        },
        [genTiming, genStyle, getIsBehind, getTransition, sessionId],
    );
    const handleShowingRef = useAppCurrentRef(handleShowing);
    const handleContextMenuOpening = useCallback((event: any) => {
        handleShowingRef.current(event, true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const setHoursRef = useAppCurrentRef(setHours);
    const handleHoursChange = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => {
            setHoursRef.current(event.target.value);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    const setMinutesRef = useAppCurrentRef(setMinutes);
    const handleMinutesChange = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => {
            setMinutesRef.current(event.target.value);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    const setSecondsRef = useAppCurrentRef(setSeconds);
    const handleSecondsChange = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => {
            setSecondsRef.current(event.target.value);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    const genTimingRef = useAppCurrentRef(genTiming);
    const getDurationSecondRef = useAppCurrentRef(getDurationSecond);
    const isAutoStartRef = useAppCurrentRef(isAutoStart);
    const genStyleRef = useAppCurrentRef(genStyle);
    const getIsBehindRef = useAppCurrentRef(getIsBehind);
    const getTransitionRef = useAppCurrentRef(getTransition);
    const sessionIdRef = useAppCurrentRef(sessionId);
    const handleInSetDragStart = useCallback((event: any) => {
        const extraStyle = genStyleRef.current();
        const isBehind = getIsBehindRef.current();
        const transitionEffect = getTransitionRef.current();
        dragStore.onDropped = handleByDropped.bind(
            null,
            sessionIdRef.current,
            genTimingRef.current,
            extraStyle,
            isBehind,
            transitionEffect,
        );
        // A duration countdown must restart from the moment it lands on a
        // screen, so the duration travels rather than the resolved date --
        // with the lead every stored row carries (`COUNTDOWN_LEAD_SECOND`),
        // and whether it starts as it lands.
        handleDragStart(
            event,
            genForegroundDragInf('countdown', () => {
                return withForegroundLayer(
                    {
                        ...toTransitionPart(transitionEffect),
                        durationSecond:
                            getDurationSecondRef.current() +
                            COUNTDOWN_LEAD_SECOND,
                        isAutoStart: isAutoStartRef.current,
                        extraStyle,
                    },
                    isBehind,
                );
            }),
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const showingLabel = isAutoStart
        ? tran('Start Countdown')
        : tran('Show Countdown');
    return (
        <div className="fg-group">
            <span className="fg-group-name">
                <i className="bi bi-hourglass-split" />
                <span>{tran('Count down for a duration')}</span>
            </span>
            <div className="fg-fields">
                <label className="fg-field" title={tran('Hours')}>
                    <i className="bi bi-clock-history" />
                    <input
                        className="fg-num"
                        type="number"
                        aria-label={tran('Hours')}
                        value={hours}
                        onChange={handleHoursChange}
                        min="0"
                    />
                    <span className="fg-unit-static">h</span>
                </label>
                <label className="fg-field" title={tran('Minutes')}>
                    <input
                        className="fg-num"
                        type="number"
                        aria-label={tran('Minutes')}
                        value={minutes}
                        onChange={handleMinutesChange}
                        min="0"
                        max="59"
                    />
                    <span className="fg-unit-static">m</span>
                </label>
                <label className="fg-field" title={tran('Seconds')}>
                    <input
                        className="fg-num"
                        type="number"
                        aria-label={tran('Seconds')}
                        value={seconds}
                        onChange={handleSecondsChange}
                        min="0"
                        max="59"
                    />
                    <span className="fg-unit-static">s</span>
                </label>
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
                    onDragStart={handleInSetDragStart}
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
            </div>
        </div>
    );
}

function refreshAllCountdowns(
    showingScreenIds: [number, ForegroundCountdownDataType][],
    extraStyle: CSSProperties,
    isBehind: boolean,
) {
    for (const [screenId, data] of showingScreenIds) {
        getScreenForegroundManagerInstances(
            screenId,
            (screenForegroundManager) => {
                screenForegroundManager.setCountdownData(null);
                screenForegroundManager.setCountdownData(
                    withForegroundLayer({ ...data, extraStyle }, isBehind),
                );
            },
        );
    }
}

function handleCountdownHiding(screenId: number) {
    getScreenForegroundManagerInstances(screenId, (screenForegroundManager) => {
        screenForegroundManager.setCountdownData(null);
    });
}

/**
 * A Start / Pause / Resume / Reset press, on every screen THIS session's
 * duration countdown is up on, all from the one moment -- so two screens
 * showing it stay on the same second.
 */
function applyToCountdowns(
    showingList: [number, ForegroundCountdownDataType][],
    toNewData: (
        data: ForegroundCountdownDataType,
        now: number,
    ) => ForegroundCountdownDataType,
) {
    const now = Date.now();
    for (const [screenId, data] of showingList) {
        getScreenForegroundManagerInstances(
            screenId,
            (screenForegroundManager) => {
                screenForegroundManager.setCountdownData(toNewData(data, now));
            },
        );
    }
}

export default function ForegroundCountDownComp() {
    useScreenForegroundManagerEvents(['update']);
    // Per-instance: nothing here may assume this panel stays a single mount.
    const attemptTimeout = useMemo(() => {
        return genTimeoutAttempt(500);
    }, []);
    const showingScreenIdDataList = getForegroundShowingScreenIdDataList(
        (data) => {
            return data.countdownData !== null;
        },
    )
        .map(
            ([screenId, data]):
                [number, ForegroundCountdownDataType] | null => {
                if (data.countdownData === null) {
                    return null;
                }
                return [screenId, data.countdownData];
            },
        )
        .filter((item) => {
            return item !== null;
        });
    const showingRef = useAppCurrentRef(showingScreenIdDataList);
    // One session is one countdown SET UP AND READY: the 5-minute one that
    // starts the service, the one counting to a date on the wall at the back.
    // Each keeps its own numbers and its own size, place and colours.
    const {
        activeId,
        sessionIds,
        suffix,
        prefix,
        element: sessionsElement,
    } = useForegroundSessions({
        widgetKey: 'countdown',
        toPrefix: (sessionSuffix) => {
            return `countdown${sessionSuffix}`;
        },
        toOwnSettingNames: genOwnSettingNames,
        checkIsOnScreen: (sessionId, _sessionSuffix, idList) => {
            return showingScreenIdDataList.some(([, data]) => {
                return checkIsSessionData(data, sessionId, idList);
            });
        },
        hideSession: (sessionId, _sessionSuffix, idList) => {
            for (const [screenId, data] of showingRef.current) {
                if (checkIsSessionData(data, sessionId, idList)) {
                    handleCountdownHiding(screenId);
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
        widgetKey: 'countdown',
        onChange: (extraStyle, isBehind) => {
            attemptTimeout(() => {
                // THIS session's countdown only -- see the stopwatch panel.
                refreshAllCountdowns(
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
    // Only a DURATION countdown has controls; one to a date & time always runs.
    const controllableList = sessionShowingList.filter(([, data]) => {
        return getCountdownState(data) !== 'fixed';
    });
    const controllableRef = useAppCurrentRef(controllableList);
    const controlState =
        controllableList.length > 0
            ? getCountdownState(controllableList[0][1])
            : 'fixed';
    const handleTimerStarting = useCallback(() => {
        applyToCountdowns(controllableRef.current, toStartedCountdownData);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleTimerPausing = useCallback(() => {
        applyToCountdowns(controllableRef.current, toPausedCountdownData);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleTimerResetting = useCallback(() => {
        applyToCountdowns(controllableRef.current, toResetCountdownData);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const genHidingElement = (isMini: boolean) => (
        <ScreensRendererComp
            showingScreenIdDataList={sessionShowingList}
            buttonText={tran('Hide Countdown')}
            handleForegroundHiding={handleCountdownHiding}
            isMini={isMini}
        />
    );
    return (
        <ForegroundLayoutComp target="countdown">
            {sessionsElement}
            {propsSetting}
            <div className="fg-body">
                {/*
                 * Keyed by the session so both forms re-read THEIR session's
                 * own date and duration. Every field below reads its setting
                 * once, when it mounts -- the same reason the Properties panel
                 * above is keyed by its prefix.
                 */}
                <CountDownOnDatetimeComp
                    key={`date-${activeId}`}
                    genStyle={genStyle}
                    getIsBehind={getIsBehind}
                    getTransition={getTransition}
                    sessionId={activeId}
                    suffix={suffix}
                />
                <CountDownInSetComp
                    key={`duration-${activeId}`}
                    genStyle={genStyle}
                    getIsBehind={getIsBehind}
                    getTransition={getTransition}
                    sessionId={activeId}
                    suffix={suffix}
                />
                {/*
                 * One report of what is on a screen for BOTH ways of starting
                 * a countdown -- there is only ever one countdown up, and two
                 * bordered boxes saying so was the panel repeating itself.
                 */}
                {controlState !== 'fixed' ? (
                    <ForegroundTimerControlsComp
                        state={controlState}
                        resetTitle={tran('Reset to the full duration')}
                        onStart={handleTimerStarting}
                        onPause={handleTimerPausing}
                        onReset={handleTimerResetting}
                    />
                ) : null}
                {sessionShowingList.length > 0 ? (
                    <div className="fg-actions">{genHidingElement(false)}</div>
                ) : null}
            </div>
        </ForegroundLayoutComp>
    );
}
