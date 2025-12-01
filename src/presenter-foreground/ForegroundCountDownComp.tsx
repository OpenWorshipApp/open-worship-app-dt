import { CSSProperties } from 'react';

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
import { genTimeoutAttempt } from '../helper/helpers';
import { ForegroundCountdownDataType } from '../_screen/screenTypeHelpers';
import ForegroundLayoutComp from './ForegroundLayoutComp';
import { dragStore } from '../helper/dragHelpers';

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
    const getTargetDateTime = () => {
        return new Date(date + ' ' + time);
    };
    const handleDateTimeShowing = (event: any, isForceChoosing = false) => {
        ScreenForegroundManager.setCountdown(
            event,
            getTargetDateTime(),
            genStyle(),
            isForceChoosing,
        );
    };
    const handleResetting = () => {
        setDate(todayString());
        setTime(nowString());
    };
    const handleContextMenuOpening = (event: any) => {
        handleDateTimeShowing(event, true);
    };
    return (
        <div className="d-flex">
            <div>
                <button
                    title="Reset Date and Time to Now"
                    className="btn btn-outline-warning"
                    onClick={handleResetting}
                >
                    `Reset
                </button>
            </div>
            <div>
                <input
                    type="date"
                    className="form-control"
                    value={date}
                    onChange={(event) => {
                        setDate(event.target.value);
                    }}
                    min={todayString()}
                />
            </div>
            <div>
                <input
                    type="time"
                    className="form-control"
                    value={time}
                    onChange={(event) => {
                        setTime(event.target.value);
                    }}
                    min={nowString()}
                />
            </div>
            <div>
                <button
                    className="btn btn-secondary"
                    onClick={handleDateTimeShowing}
                    onContextMenu={handleContextMenuOpening}
                    draggable
                    onDragStart={() => {
                        dragStore.onDropped = handleByDropped.bind(
                            null,
                            getTargetDateTime(),
                            genStyle(),
                        );
                    }}
                >
                    `Start Countdown to DateTime
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
    const getTargetDateTime = () => {
        const targetDatetime = new Date();
        targetDatetime.setSeconds(
            targetDatetime.getSeconds() +
                60 * Number.parseInt(minutes) +
                3600 * Number.parseInt(hours) +
                1,
        );
        return targetDatetime;
    };
    const handleShowing = (event: any, isForceChoosing = false) => {
        const targetDateTime = getTargetDateTime();
        const style = genStyle();
        ScreenForegroundManager.setCountdown(
            event,
            targetDateTime,
            style,
            isForceChoosing,
        );
    };
    const handleContextMenuOpening = (event: any) => {
        handleShowing(event, true);
    };
    return (
        <div className="d-flex">
            <div
                className="input-group"
                style={{ width: '120px' }}
                title="Hours"
            >
                <div className="input-group-text">H:</div>
                <input
                    className="form-control form-control-sm"
                    type="number"
                    value={hours}
                    onChange={(event) => {
                        setHours(event.target.value);
                    }}
                    min="0"
                />
            </div>
            <div
                className="input-group"
                style={{ width: '120px' }}
                title="Minutes"
            >
                <div className="input-group-text">M:</div>
                <input
                    className="form-control form-control-sm"
                    type="number"
                    value={minutes}
                    onChange={(event) => {
                        setMinutes(event.target.value);
                    }}
                    min="0"
                    max="59"
                />
            </div>
            <div>
                <button
                    className="btn btn-secondary"
                    onClick={handleShowing}
                    onContextMenu={handleContextMenuOpening}
                    draggable
                    onDragStart={() => {
                        dragStore.onDropped = handleByDropped.bind(
                            null,
                            getTargetDateTime(),
                            genStyle(),
                        );
                    }}
                >
                    `Start Countdown
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
            buttonText="`Hide Countdown"
            handleForegroundHiding={handleCountdownHiding}
            isMini={isMini}
        />
    );
    return (
        <ForegroundLayoutComp
            target="countdown"
            fullChildHeaders={<h4>`Countdown</h4>}
            childHeadersOnHidden={genHidingElement(true)}
        >
            {propsSetting}
            <hr />
            <div>
                <CountDownOnDatetimeComp genStyle={genStyle} />
            </div>
            <div>
                <CountDownInSetComp genStyle={genStyle} />
            </div>
            <div>{genHidingElement(false)}</div>
        </ForegroundLayoutComp>
    );
}
