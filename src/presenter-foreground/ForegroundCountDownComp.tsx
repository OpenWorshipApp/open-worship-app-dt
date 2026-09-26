import { type ChangeEvent, type CSSProperties } from 'react';
import { useCallback, useMemo } from 'react';

import ContextMenuDotsButtonComp from '../context-menu/ContextMenuDotsButtonComp';
import { tran } from '../lang/langHelpers';
import { useStateSettingString } from '../helper/settingHelpers';
import ScreenForegroundManager from '../_screen/managers/ScreenForegroundManager';
import {
    getScreenForegroundManagerInstances,
    getForegroundShowingScreenIdDataList,
    getScreenForegroundManagerByDropped,
} from './foregroundHelpers';
import ScreensRendererComp from './ScreensRendererComp';
import { useScreenForegroundManagerEvents } from '../_screen/managers/screenEventHelpers';
import { useForegroundPropsSetting } from './propertiesSettingHelpers';
import type { ForegroundCountdownDataType } from '../_screen/screenTypeHelpers';
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

/**
 * The keys ONE session of this panel owns beyond its Properties -- the target
 * date and time of the first form, the hours and minutes of the second.
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
    ];
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

const handleByDropped = (
    sessionId: string,
    dateTime: Date,
    extraStyle: CSSProperties,
    event: any,
) => {
    const screenForegroundManager = getScreenForegroundManagerByDropped(event);
    if (screenForegroundManager === null) {
        return;
    }
    screenForegroundManager.setCountdownData({
        // A LIVE drop from this panel is this session acting; a run-sheet row
        // replayed weeks later carries none -- see `applyForegroundDragData`.
        id: sessionId || undefined,
        dateTime,
        extraStyle,
    });
};

function CountDownOnDatetimeComp({
    genStyle,
    sessionId,
    suffix,
}: Readonly<{
    genStyle: () => CSSProperties;
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
            ScreenForegroundManager.setCountdown(
                event,
                getTargetDateTime(),
                genStyle(),
                isForceChoosing,
                sessionId,
            );
        },
        [getTargetDateTime, genStyle, sessionId],
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
    const sessionIdRef = useAppCurrentRef(sessionId);
    const handleDraggingStart = useCallback((event: any) => {
        const targetDateTime = getTargetDateTimeRef.current();
        const extraStyle = genStyleRef.current();
        dragStore.onDropped = handleByDropped.bind(
            null,
            sessionIdRef.current,
            targetDateTime,
            extraStyle,
        );
        handleDragStart(
            event,
            genForegroundDragInf('countdown', () => {
                return {
                    dateTime: targetDateTime.toJSON(),
                    extraStyle,
                };
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
    sessionId,
    suffix,
}: Readonly<{
    genStyle: () => CSSProperties;
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
    const getDurationSecond = useCallback(() => {
        return (
            60 * Number.parseInt(minutes) + 3600 * Number.parseInt(hours) + 1
        );
    }, [minutes, hours]);
    const getTargetDateTime = useCallback(() => {
        const targetDatetime = new Date();
        targetDatetime.setSeconds(
            targetDatetime.getSeconds() + getDurationSecond(),
        );
        return targetDatetime;
    }, [getDurationSecond]);
    const handleShowing = useCallback(
        (event: any, isForceChoosing = false) => {
            const targetDateTime = getTargetDateTime();
            const style = genStyle();
            ScreenForegroundManager.setCountdown(
                event,
                targetDateTime,
                style,
                isForceChoosing,
                sessionId,
            );
        },
        [getTargetDateTime, genStyle, sessionId],
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
    const getTargetDateTimeRef = useAppCurrentRef(getTargetDateTime);
    const getDurationSecondRef = useAppCurrentRef(getDurationSecond);
    const genStyleRef = useAppCurrentRef(genStyle);
    const sessionIdRef = useAppCurrentRef(sessionId);
    const handleInSetDragStart = useCallback((event: any) => {
        const extraStyle = genStyleRef.current();
        dragStore.onDropped = handleByDropped.bind(
            null,
            sessionIdRef.current,
            getTargetDateTimeRef.current(),
            extraStyle,
        );
        // A duration countdown must restart from the moment it lands on a
        // screen, so the duration travels rather than the resolved date.
        handleDragStart(
            event,
            genForegroundDragInf('countdown', () => {
                return {
                    durationSecond: getDurationSecondRef.current(),
                    extraStyle,
                };
            }),
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
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
            </div>
            <div className="fg-actions">
                <button
                    className="btn btn-primary"
                    title={tran('Start Countdown')}
                    onClick={handleShowing}
                    onContextMenu={handleContextMenuOpening}
                    draggable
                    onDragStart={handleInSetDragStart}
                >
                    <i className="bi bi-play-fill" /> {tran('Start Countdown')}
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
) {
    for (const [screenId, data] of showingScreenIds) {
        getScreenForegroundManagerInstances(
            screenId,
            (screenForegroundManager) => {
                screenForegroundManager.setCountdownData(null);
                screenForegroundManager.setCountdownData({
                    ...data,
                    extraStyle,
                });
            },
        );
    }
}

function handleCountdownHiding(screenId: number) {
    getScreenForegroundManagerInstances(screenId, (screenForegroundManager) => {
        screenForegroundManager.setCountdownData(null);
    });
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
        suffix,
        prefix,
        element: sessionsElement,
    } = useForegroundSessions({
        widgetKey: 'countdown',
        toPrefix: (sessionSuffix) => {
            return `countdown${sessionSuffix}`;
        },
        toOwnSettingNames: genOwnSettingNames,
        checkIsOnScreen: (sessionId) => {
            return showingScreenIdDataList.some(([, data]) => {
                return checkIsSessionData(data, sessionId);
            });
        },
        hideSession: (sessionId) => {
            for (const [screenId, data] of showingRef.current) {
                if (checkIsSessionData(data, sessionId)) {
                    handleCountdownHiding(screenId);
                }
            }
        },
    });
    const { genStyle, element: propsSetting } = useForegroundPropsSetting({
        prefix,
        onChange: (extraStyle) => {
            attemptTimeout(() => {
                // THIS session's countdown only -- see the stopwatch panel.
                refreshAllCountdowns(
                    toSessionShowingList(showingRef.current, activeId),
                    extraStyle,
                );
            });
        },
        isFontSize: true,
    });
    const genHidingElement = (isMini: boolean) => (
        <ScreensRendererComp
            showingScreenIdDataList={showingScreenIdDataList}
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
                    sessionId={activeId}
                    suffix={suffix}
                />
                <CountDownInSetComp
                    key={`duration-${activeId}`}
                    genStyle={genStyle}
                    sessionId={activeId}
                    suffix={suffix}
                />
                {/*
                 * One report of what is on a screen for BOTH ways of starting
                 * a countdown -- there is only ever one countdown up, and two
                 * bordered boxes saying so was the panel repeating itself.
                 */}
                {showingScreenIdDataList.length > 0 ? (
                    <div className="fg-actions">{genHidingElement(false)}</div>
                ) : null}
            </div>
        </ForegroundLayoutComp>
    );
}
