import { type ChangeEvent, type CSSProperties } from 'react';
import { useCallback } from 'react';

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
import { dragStore } from '../helper/dragHelpers';
import { genTimeoutAttempt } from '../helper/timeoutHelpers';
import { useAppCurrentRef } from '../helper/appHooks';

function useTiming() {
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
        'foreground-date-setting',
        todayString(),
    );
    const [time, setTime] = useStateSettingString<string>(
        'foreground-time-setting',
        nowString(),
    );
    return { date, setDate, time, setTime, nowString, todayString };
}

const handleByDropped = (
    dateTime: Date,
    extraStyle: CSSProperties,
    event: any,
) => {
    const screenForegroundManager = getScreenForegroundManagerByDropped(event);
    if (screenForegroundManager === null) {
        return;
    }
    screenForegroundManager.setCountdownData({
        dateTime,
        extraStyle,
    });
};

function CountDownOnDatetimeComp({
    genStyle,
}: Readonly<{
    genStyle: () => CSSProperties;
}>) {
    const { date, setDate, time, setTime, nowString, todayString } =
        useTiming();
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
            );
        },
        [getTargetDateTime, genStyle],
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
    const handleDragStart = useCallback(() => {
        dragStore.onDropped = handleByDropped.bind(
            null,
            getTargetDateTimeRef.current(),
            genStyleRef.current(),
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        <div className="app-border-white-round p-2">
            <div className="d-flex align-items-center gap-1 mb-2 text-muted">
                <i className="bi bi-calendar-event" />
                <small>{tran('Count down to a specific date & time')}</small>
            </div>
            <div className="d-flex flex-wrap align-items-center gap-2">
                <button
                    title="Reset Date and Time to Now"
                    className="btn btn-outline-warning"
                    onClick={handleResetting}
                >
                    <i className="bi bi-arrow-counterclockwise" />{' '}
                    {tran('Reset')}
                </button>
                <div className="input-group" style={{ width: 'auto' }}>
                    <span className="input-group-text">
                        <i className="bi bi-calendar3" />
                    </span>
                    <input
                        type="date"
                        className="form-control"
                        value={date}
                        onChange={handleDateChange}
                        min={todayString()}
                    />
                </div>
                <div className="input-group" style={{ width: 'auto' }}>
                    <span className="input-group-text">
                        <i className="bi bi-clock" />
                    </span>
                    <input
                        type="time"
                        className="form-control"
                        value={time}
                        onChange={handleTimeChange}
                        min={nowString()}
                    />
                </div>
                <button
                    className="btn btn-primary"
                    title={tran('Start Countdown to DateTime')}
                    onClick={handleDateTimeShowing}
                    onContextMenu={handleContextMenuOpening}
                    draggable
                    onDragStart={handleDragStart}
                >
                    <i className="bi bi-play-fill" />{' '}
                    {tran('Start Countdown to DateTime')}
                </button>
            </div>
        </div>
    );
}

function CountDownInSetComp({
    genStyle,
}: Readonly<{
    genStyle: () => CSSProperties;
}>) {
    const [hours, setHours] = useStateSettingString<string>(
        'foreground-hours-setting',
        '0',
    );
    const [minutes, setMinutes] = useStateSettingString<string>(
        'foreground-minutes-setting',
        '5',
    );
    const getTargetDateTime = useCallback(() => {
        const targetDatetime = new Date();
        targetDatetime.setSeconds(
            targetDatetime.getSeconds() +
                60 * Number.parseInt(minutes) +
                3600 * Number.parseInt(hours) +
                1,
        );
        return targetDatetime;
    }, [minutes, hours]);
    const handleShowing = useCallback(
        (event: any, isForceChoosing = false) => {
            const targetDateTime = getTargetDateTime();
            const style = genStyle();
            ScreenForegroundManager.setCountdown(
                event,
                targetDateTime,
                style,
                isForceChoosing,
            );
        },
        [getTargetDateTime, genStyle],
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
    const genStyleRef = useAppCurrentRef(genStyle);
    const handleInSetDragStart = useCallback(() => {
        dragStore.onDropped = handleByDropped.bind(
            null,
            getTargetDateTimeRef.current(),
            genStyleRef.current(),
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        <div className="app-border-white-round p-2">
            <div className="d-flex align-items-center gap-1 mb-2 text-muted">
                <i className="bi bi-hourglass-split" />
                <small>{tran('Count down for a duration')}</small>
            </div>
            <div className="d-flex flex-wrap align-items-center gap-2">
                <div
                    className="input-group"
                    style={{ width: '130px' }}
                    title="Hours"
                >
                    <span className="input-group-text">
                        <i className="bi bi-clock-history" />
                    </span>
                    <input
                        className="form-control"
                        type="number"
                        value={hours}
                        onChange={handleHoursChange}
                        min="0"
                    />
                    <span className="input-group-text">h</span>
                </div>
                <div
                    className="input-group"
                    style={{ width: '130px' }}
                    title="Minutes"
                >
                    <input
                        className="form-control"
                        type="number"
                        value={minutes}
                        onChange={handleMinutesChange}
                        min="0"
                        max="59"
                    />
                    <span className="input-group-text">m</span>
                </div>
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
            </div>
        </div>
    );
}

const attemptTimeout = genTimeoutAttempt(500);
function refreshAllCountdowns(
    showingScreenIds: [number, ForegroundCountdownDataType][],
    extraStyle: CSSProperties,
) {
    attemptTimeout(() => {
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
    });
}

function handleCountdownHiding(screenId: number) {
    getScreenForegroundManagerInstances(screenId, (screenForegroundManager) => {
        screenForegroundManager.setCountdownData(null);
    });
}

export default function ForegroundCountDownComp() {
    useScreenForegroundManagerEvents(['update']);
    const showingScreenIdDataList = getForegroundShowingScreenIdDataList(
        (data) => {
            return data.countdownData !== null;
        },
    )
        .map(
            ([screenId, data]):
                | [number, ForegroundCountdownDataType]
                | null => {
                if (data.countdownData === null) {
                    return null;
                }
                return [screenId, data.countdownData];
            },
        )
        .filter((item) => {
            return item !== null;
        });
    const { genStyle, element: propsSetting } = useForegroundPropsSetting({
        prefix: 'countdown',
        onChange: (extraStyle) => {
            refreshAllCountdowns(showingScreenIdDataList, extraStyle);
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
        <ForegroundLayoutComp
            target="countdown"
            fullChildHeaders={<h4>{tran('Countdown')}</h4>}
            childHeadersOnHidden={genHidingElement(true)}
            isOnScreen={showingScreenIdDataList.length > 0}
        >
            {propsSetting}
            <hr />
            <div className="d-flex flex-column gap-2">
                <CountDownOnDatetimeComp genStyle={genStyle} />
                <CountDownInSetComp genStyle={genStyle} />
            </div>
            <div className="mt-2">{genHidingElement(false)}</div>
        </ForegroundLayoutComp>
    );
}
