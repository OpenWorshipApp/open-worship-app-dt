import { type ChangeEvent, useCallback, type CSSProperties } from 'react';
import { useMemo, useState } from 'react';
import ContextMenuDotsButtonComp from '../context-menu/ContextMenuDotsButtonComp';
import { tz } from 'moment-timezone';

import { tran } from '../lang/langHelpers';
import {
    useStateSettingBoolean,
    useStateSettingNumber,
    useStateSettingString,
} from '../helper/settingHelpers';
import { genStringListSettingManager } from '../helper/SettingManager';
import ScreenForegroundManager from '../_screen/managers/ScreenForegroundManager';
import {
    getScreenForegroundManagerInstances,
    getForegroundShowingScreenIdDataList,
    getScreenForegroundManagerByDropped,
} from './foregroundHelpers';
import ScreensRendererComp from './ScreensRendererComp';
import { useScreenForegroundManagerEvents } from '../_screen/managers/screenEventHelpers';
import { useForegroundPropsSetting } from './propertiesSettingHelpers';
import type { ForegroundTimeDataType } from '../_screen/screenTypeHelpers';
import { showAppContextMenu } from '../context-menu/appContextMenuHelpers';
import { genContextMenuItemIcon } from '../context-menu/contextMenuIconHelpers';
import ForegroundLayoutComp from './ForegroundLayoutComp';
import { useAppEffect, useAppCurrentRef } from '../helper/appHooks';
import { dragStore, handleDragStart } from '../helper/dragHelpers';
import { genForegroundDragInf } from './foregroundDragHelpers';
import { genTimeoutAttempt } from '../helper/timeoutHelpers';
import {
    genForegroundPropsSettingNames,
    useForegroundSessions,
} from './foregroundSessionHelpers';

/** Every setting ONE clock owns, whichever session holds it. */
function genClockSettingNames(id: string) {
    return [
        `foreground-city-name-setting-${id}`,
        `foreground-timezone-minute-offset-setting-${id}`,
        `foreground-time-is-24-hour-format-setting-${id}`,
        ...genForegroundPropsSettingNames(`time-${id}`),
    ];
}

/**
 * Where one session's clocks are listed. A clock's own id is a uuid, so the
 * clocks themselves never collide between sessions -- only the LIST of them
 * needs the suffix.
 */
function toIdListSettingName(suffix: string) {
    return `foreground-time-id-list${suffix}`;
}

/**
 * HOURS, despite every surrounding name. `TimingController` multiplies this by
 * `60 * 60 * 1000`, so hours is what the whole chain has always meant -- the
 * box just used to be labelled `min`, and a volunteer who typed the minute
 * offset for their city (420 for Phnom Penh) got a clock weeks out. The data
 * field and the setting key keep the old `...MinuteOffset` spelling on purpose:
 * they are persisted in `screen-foreground-manager` and in one setting file per
 * clock, and renaming them would blank a clock that is already on a screen.
 */
function getSystemTimezoneHourOffset() {
    const date = new Date();
    return -date.getTimezoneOffset() / 60;
}

function getHourOffsetFromCity(event: any) {
    return new Promise<[string, number] | null>((resolve) => {
        const cityNames = tz
            .names()
            .map((name): [string, string] => {
                const arr = name.split('/');
                const city = arr.at(-1);
                return [city ?? 'Unknown', name];
            })
            .sort((a, b) => {
                return a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]);
            });
        const promise = showAppContextMenu(
            event,
            cityNames.map(([city, name]) => {
                const title = `${city} (${name})`;
                return {
                    childBefore: genContextMenuItemIcon('clock'),
                    menuElement: title,
                    onSelect: () => {
                        const hourOffset = tz(name).utcOffset() / 60;
                        resolve([title, hourOffset]);
                    },
                };
            }),
        );
        promise.promiseDone.then(() => {
            resolve(null);
        });
    });
}

function TimeInSetComp({
    id,
    genStyle,
    showingScreenIdDataList,
}: Readonly<{
    id: string;
    genStyle: () => CSSProperties;
    showingScreenIdDataList: [number, ForegroundTimeDataType][];
}>) {
    const [cityName, setCityName] = useStateSettingString<string>(
        `foreground-city-name-setting-${id}`,
        '',
    );
    const [timezoneMinuteOffset, setTimezoneMinuteOffset] =
        useStateSettingNumber(
            `foreground-timezone-minute-offset-setting-${id}`,
            getSystemTimezoneHourOffset,
        );
    const [is24HourFormat, setIs24HourFormat] = useStateSettingBoolean(
        `foreground-time-is-24-hour-format-setting-${id}`,
        false,
    );
    const genTimeData = useCallback(
        (newIs24HourFormat = is24HourFormat): ForegroundTimeDataType => {
            return {
                id,
                timezoneMinuteOffset,
                title: cityName || null,
                is24HourFormat: newIs24HourFormat,
                extraStyle: genStyle(),
            };
        },
        [id, timezoneMinuteOffset, cityName, is24HourFormat, genStyle],
    );
    const isAmPmFormat = !is24HourFormat;
    const handleShowing = useCallback(
        (event: any, isForceChoosing = false) => {
            ScreenForegroundManager.addTimeData(
                event,
                genTimeData(),
                isForceChoosing,
            );
        },
        [genTimeData],
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
            screenForegroundManager.addTimeData(genTimeData());
        },
        [genTimeData],
    );
    const setTimezoneMinuteOffsetRef = useAppCurrentRef(
        setTimezoneMinuteOffset,
    );
    const handleUseCurrentTimezone = useCallback(() => {
        setTimezoneMinuteOffsetRef.current(getSystemTimezoneHourOffset());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const setCityNameRef = useAppCurrentRef(setCityName);
    const handleChooseCity = useCallback(async (event: any) => {
        const result = await getHourOffsetFromCity(event);
        if (result === null) {
            return;
        }
        setCityNameRef.current(result[0]);
        setTimezoneMinuteOffsetRef.current(result[1]);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleCityNameChange = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => {
            setCityNameRef.current(event.target.value);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    const handleTimezoneOffsetChange = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => {
            // HOURS, and `parseFloat` rather than `parseInt`: India is +5:30
            // and Nepal +5:45, and truncating those put the clock half an hour
            // out. An empty or half-typed box parses to NaN, which would reach
            // `TimingController` as an Invalid Date -- hold the old value.
            const newOffset = Number.parseFloat(event.target.value);
            if (Number.isNaN(newOffset)) {
                return;
            }
            setTimezoneMinuteOffsetRef.current(newOffset);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    const setIs24HourFormatRef = useAppCurrentRef(setIs24HourFormat);
    const showingScreenIdDataListRef = useAppCurrentRef(
        showingScreenIdDataList,
    );
    const genTimeDataRef = useAppCurrentRef(genTimeData);
    // per-instance: one settings block per time widget — a shared module
    // timer would drop the earlier widget's refresh
    const refreshAttemptTimeout = useMemo(() => genTimeoutAttempt(500), []);
    const handleTimeFormatChange = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => {
            const newIs24HourFormat = !event.target.checked;
            setIs24HourFormatRef.current(newIs24HourFormat);
            refreshAttemptTimeout(() => {
                refreshAllTimes(showingScreenIdDataListRef.current, () => {
                    return genTimeDataRef.current(newIs24HourFormat);
                });
            });
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    const handleByDroppedRef = useAppCurrentRef(handleByDropped);
    const handleTimeDragStart = useCallback((event: any) => {
        dragStore.onDropped = handleByDroppedRef.current;
        handleDragStart(
            event,
            genForegroundDragInf('time', () => {
                return genTimeDataRef.current();
            }),
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        <div className="fg-group">
            <div className="fg-fields">
                <button
                    type="button"
                    className="fg-quiet-btn"
                    title={tran('Use this device’s timezone')}
                    onClick={handleUseCurrentTimezone}
                >
                    <i className="bi bi-geo-alt" />
                    <span>{tran('Use Current Timezone')}</span>
                </button>
                <button
                    type="button"
                    className="fg-quiet-btn"
                    title={tran('Pick a city to set its timezone')}
                    onClick={handleChooseCity}
                >
                    <i className="bi bi-globe-americas" />
                    <span>{tran('Choose City')}</span>
                </button>
            </div>
            <div className="fg-fields">
                <label
                    className="fg-field fg-field-grow"
                    title={tran('Label shown above the time')}
                >
                    <i className="bi bi-buildings" />
                    <input
                        type="text"
                        aria-label={tran('Label shown above the time')}
                        placeholder={tran('City')}
                        value={cityName}
                        onChange={handleCityNameChange}
                    />
                </label>
                <label
                    className="fg-field"
                    title={tran('Timezone Hour Offset')}
                >
                    <i className="bi bi-clock" />
                    <span className="fg-field-name">{tran('UTC Offset')}</span>
                    <input
                        className="fg-num"
                        type="number"
                        step="0.25"
                        aria-label={tran('Timezone Hour Offset')}
                        value={timezoneMinuteOffset}
                        onChange={handleTimezoneOffsetChange}
                    />
                    <span className="fg-unit-static">h</span>
                </label>
                <label className="fg-field" htmlFor={`time-format-${id}`}>
                    <input
                        className="form-check-input app-caught-hover-pointer mt-0"
                        type="checkbox"
                        role="switch"
                        id={`time-format-${id}`}
                        checked={isAmPmFormat}
                        onChange={handleTimeFormatChange}
                    />
                    <span className="fg-field-name">{tran('AM/PM')}</span>
                </label>
            </div>
            <div className="fg-actions">
                <button
                    className="btn btn-primary"
                    title={tran('Show Time')}
                    onClick={handleShowing}
                    onContextMenu={handleContextMenuOpening}
                    draggable
                    onDragStart={handleTimeDragStart}
                >
                    <i className="bi bi-display" /> {tran('Show Time')}
                </button>
                <ContextMenuDotsButtonComp
                    label={tran('Show on Screens')}
                    onOpening={handleContextMenuOpening}
                />
            </div>
        </div>
    );
}

function refreshAllTimes(
    showingScreenIdDataList: [number, ForegroundTimeDataType][],
    getTimeData: (timeData: ForegroundTimeDataType) => ForegroundTimeDataType,
) {
    for (const [screenId, timeData] of showingScreenIdDataList) {
        getScreenForegroundManagerInstances(
            screenId,
            (screenForegroundManager) => {
                screenForegroundManager.removeTimeData(timeData);
                screenForegroundManager.addTimeData(getTimeData(timeData));
            },
        );
    }
}

function handleHiding(screenId: number, timeData: ForegroundTimeDataType) {
    getScreenForegroundManagerInstances(screenId, (screenForegroundManager) => {
        screenForegroundManager.removeTimeData(timeData);
    });
}

function getAllShowingScreenIdDataList() {
    const showingScreenIdDataList = getForegroundShowingScreenIdDataList(
        ({ timeDataList }) => {
            return timeDataList.length > 0;
        },
    ).reduce(
        (acc, [screenId, { timeDataList }]) => {
            return acc.concat(
                timeDataList.map((data) => {
                    return [screenId, data];
                }),
            );
        },
        [] as [number, ForegroundTimeDataType][],
    );
    return showingScreenIdDataList;
}

function ForegroundTimeItemComp({
    id,
    itemNumber,
    onRemove,
}: Readonly<{ id: string; itemNumber: number; onRemove?: () => void }>) {
    useScreenForegroundManagerEvents(['update']);
    const showingScreenIdDataList = getAllShowingScreenIdDataList().filter(
        ([, data]) => data.id === id,
    );
    // per-instance: one item per time widget id
    const attemptTimeout = useMemo(() => genTimeoutAttempt(500), []);
    const { genStyle, element: propsSetting } = useForegroundPropsSetting({
        prefix: 'time-' + id,
        onChange: (extraStyle) => {
            attemptTimeout(() => {
                refreshAllTimes(showingScreenIdDataList, (timeData) => {
                    return {
                        ...timeData,
                        extraStyle,
                    };
                });
            });
        },
        isFontSize: true,
    });
    const removeLabel = `${tran('Remove Time')} ${itemNumber}`;
    return (
        <ForegroundLayoutComp
            target={'time-' + id}
            // The border stays: these sit in a LIST, so it separates one
            // clock from the next rather than boxing a panel inside a panel.
            extraBodyClassName="app-border-white-round p-2"
        >
            {onRemove ? (
                // A real button, named and numbered. It used to be a bare
                // `<i onClick>` with no title, aria-label, role or tabIndex:
                // absent from the accessibility tree, unreachable from the
                // keyboard, and the only control in this panel a screen reader
                // could not announce. The number matters for the same reason it
                // does on a message -- three clocks otherwise give three
                // controls with one name.
                <button
                    className="btn btn-sm btn-outline-danger float-end"
                    title={removeLabel}
                    aria-label={removeLabel}
                    onClick={() => {
                        for (const [
                            screenId,
                            timeData,
                        ] of showingScreenIdDataList) {
                            handleHiding(screenId, timeData);
                        }
                        onRemove();
                    }}
                >
                    <i className="bi bi-x-lg" />
                </button>
            ) : null}
            {propsSetting}
            <div className="fg-body">
                <TimeInSetComp
                    genStyle={genStyle}
                    id={id}
                    showingScreenIdDataList={showingScreenIdDataList}
                />
                {showingScreenIdDataList.length > 0 ? (
                    <div className="fg-actions">
                        <ScreensRendererComp
                            showingScreenIdDataList={showingScreenIdDataList}
                            buttonText={tran('Hide Time')}
                            handleForegroundHiding={handleHiding}
                            isMini={false}
                        />
                    </div>
                ) : null}
            </div>
        </ForegroundLayoutComp>
    );
}

/**
 * This session's clocks. One manager per session, made on the suffix rather
 * than at module scope: the module-level one wrote every session's list to
 * the same key.
 */
function useIdList(suffix: string) {
    const idListSettingManager = useMemo(() => {
        return genStringListSettingManager(toIdListSettingName(suffix));
    }, [suffix]);
    const [idList, setIdList] = useState<string[]>([]);
    const setIdList1 = (newIdList: string[]) => {
        setIdList(newIdList);
        idListSettingManager.setSetting(newIdList);
    };
    useAppEffect(() => {
        const storedIdList = idListSettingManager.getSetting();
        if (storedIdList.length > 0) {
            setIdList(storedIdList);
            return;
        }
        setIdList1([crypto.randomUUID()]);
    }, [idListSettingManager]);
    return [idList, setIdList1] as const;
}

/** The clocks one session holds, read straight off its own setting. */
function readSessionIdList(suffix: string) {
    return genStringListSettingManager(
        toIdListSettingName(suffix),
    ).getSetting();
}

/** The panel, ON ONE SESSION: that session's clocks and nothing else. */
function TimeBodyComp({ suffix }: Readonly<{ suffix: string }>) {
    const [idList, setIdList] = useIdList(suffix);
    return (
        <>
            <div className="d-flex flex-wrap gap-1">
                {idList.map((id, index) => {
                    return (
                        <ForegroundTimeItemComp
                            key={id}
                            id={id}
                            itemNumber={index + 1}
                            onRemove={
                                idList.length > 1
                                    ? () => {
                                          setIdList(
                                              idList.filter((item) => {
                                                  return item !== id;
                                              }),
                                          );
                                      }
                                    : undefined
                            }
                        />
                    );
                })}
                <button
                    type="button"
                    className="fg-quiet-btn"
                    title={tran('Add Time')}
                    onClick={() => {
                        setIdList([...idList, crypto.randomUUID()]);
                    }}
                >
                    <i className="bi bi-plus-lg" />
                    <span>{tran('Add Time')}</span>
                </button>
            </div>
        </>
    );
}

export default function ForegroundTimeComp() {
    useScreenForegroundManagerEvents(['update']);
    // A session here holds a whole SET of clocks: the one wall of world
    // times for a mission Sunday, the single service clock the rest of the
    // year -- kept side by side instead of built again each time.
    const { suffix, element: sessionsElement } = useForegroundSessions({
        widgetKey: 'time',
        // No `toPrefix`: the Properties here belong to each CLOCK
        // (`time-<uuid>`) rather than to the session, so a session prefix
        // would name twenty keys nothing ever wrote. The clocks' own keys
        // are swept below instead.
        toOwnSettingNames: (sessionSuffix) => {
            return [
                toIdListSettingName(sessionSuffix),
                ...readSessionIdList(sessionSuffix).flatMap(
                    genClockSettingNames,
                ),
            ];
        },
        checkIsOnScreen: (_sessionId, sessionSuffix) => {
            const idSet = new Set(readSessionIdList(sessionSuffix));
            return getAllShowingScreenIdDataList().some(([, data]) => {
                return idSet.has(data.id);
            });
        },
        hideSession: (_sessionId, sessionSuffix) => {
            const idSet = new Set(readSessionIdList(sessionSuffix));
            for (const [screenId, data] of getAllShowingScreenIdDataList()) {
                if (idSet.has(data.id)) {
                    handleHiding(screenId, data);
                }
            }
        },
    });
    return (
        <ForegroundLayoutComp target="time">
            {sessionsElement}
            {/* Keyed by the session so the list is re-read from ITS key. */}
            <TimeBodyComp key={suffix} suffix={suffix} />
        </ForegroundLayoutComp>
    );
}
