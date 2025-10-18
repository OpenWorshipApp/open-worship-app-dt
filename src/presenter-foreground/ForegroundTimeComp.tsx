import { CSSProperties } from 'react';
import { tz } from 'moment-timezone';

import {
    getSetting,
    setSetting,
    useStateSettingNumber,
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
import { genTimeoutAttempt } from '../helper/helpers';
import { ForegroundTimeDataType } from '../_screen/screenTypeHelpers';
import { showAppContextMenu } from '../context-menu/appContextMenuHelpers';
import ForegroundLayoutComp from './ForegroundLayoutComp';
import { useState } from 'react';
import { useAppEffect } from '../helper/debuggerHelpers';
import { handleError } from '../helper/errorHelpers';
import { dragStore } from '../helper/dragHelpers';

function getSystemTimezoneMinuteOffset() {
    const date = new Date();
    return -date.getTimezoneOffset() / 60;
}

function getMinuteOffsetFromCity(event: any) {
    return new Promise<[string, number] | null>((resolve) => {
        const cityNames = tz
            .names()
            .map((name) => {
                const arr = name.split('/');
                const city = arr[arr.length - 1];
                return [city, name] as [string, string];
            })
            .sort((a, b) => {
                return a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]);
            });
        const promise = showAppContextMenu(
            event,
            cityNames.map(([city, name]) => {
                const title = `${city} (${name})`;
                return {
                    menuElement: title,
                    onSelect: () => {
                        const minuteOffset = tz(name).utcOffset() / 60;
                        resolve([title, minuteOffset]);
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
}: Readonly<{
    id: string;
    genStyle: () => CSSProperties;
}>) {
    const [cityName, setCityName] = useStateSettingString<string>(
        `foreground-city-name-setting-${id}`,
        '',
    );
    const [timezoneMinuteOffset, setTimezoneMinuteOffset] =
        useStateSettingNumber(
            `foreground-timezone-minute-offset-setting-${id}`,
            getSystemTimezoneMinuteOffset(),
        );
    const handleShowing = (event: any, isForceChoosing = false) => {
        ScreenForegroundManager.addTimeData(
            event,
            {
                id,
                timezoneMinuteOffset,
                title: cityName || null,
                extraStyle: genStyle(),
            },
            isForceChoosing,
        );
    };
    const handleContextMenuOpening = (event: any) => {
        handleShowing(event, true);
    };
    const handleByDropped = (event: any) => {
        const screenForegroundManager =
            getScreenForegroundManagerByDropped(event);
        if (screenForegroundManager === null) {
            return;
        }
        screenForegroundManager.addTimeData({
            id,
            timezoneMinuteOffset,
            title: cityName || null,
            extraStyle: genStyle(),
        });
    };
    return (
        <div className="d-flex flex-column">
            <div className="btn-group">
                <button
                    className="btn btn-outline-secondary"
                    onClick={() => {
                        setTimezoneMinuteOffset(
                            getSystemTimezoneMinuteOffset(),
                        );
                    }}
                >
                    Use Current Timezone
                </button>
                <button
                    className="btn btn-outline-secondary"
                    onClick={async (event) => {
                        const result = await getMinuteOffsetFromCity(event);
                        console.log(result);
                        if (result === null) {
                            return;
                        }
                        setCityName(result[0]);
                        setTimezoneMinuteOffset(result[1]);
                    }}
                >
                    Choose City
                </button>
            </div>
            <hr />
            <div className="d-flex">
                <div className="input-group" style={{ width: '250px' }}>
                    <div className="input-group-text">City:</div>
                    <input
                        className="form-control form-control-sm"
                        type="text"
                        value={cityName}
                        onChange={(event) => {
                            setCityName(event.target.value);
                        }}
                    />
                </div>
                <div className="input-group" style={{ width: '270px' }}>
                    <div className="input-group-text">
                        Timezone Minute Offset:
                    </div>
                    <input
                        className="form-control form-control-sm"
                        type="number"
                        value={timezoneMinuteOffset}
                        onChange={(event) => {
                            setTimezoneMinuteOffset(
                                Number.parseInt(event.target.value),
                            );
                        }}
                    />
                </div>
                <div>
                    <button
                        className="btn btn-secondary"
                        onClick={handleShowing}
                        onContextMenu={handleContextMenuOpening}
                        draggable
                        onDragStart={() => {
                            dragStore.onDropped = handleByDropped;
                        }}
                    >
                        `Show Time
                    </button>
                </div>
            </div>
        </div>
    );
}

const attemptTimeout = genTimeoutAttempt(500);
function refreshAllTimes(
    showingScreenIdDataList: [number, ForegroundTimeDataType][],
    extraStyle: CSSProperties,
) {
    attemptTimeout(() => {
        showingScreenIdDataList.forEach(([screenId, timeData]) => {
            getScreenForegroundManagerInstances(
                screenId,
                (screenForegroundManager) => {
                    screenForegroundManager.removeTimeData(timeData);
                    screenForegroundManager.addTimeData({
                        ...timeData,
                        extraStyle,
                    });
                },
            );
        });
    });
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
    onRemove,
}: Readonly<{ id: string; onRemove?: () => void }>) {
    useScreenForegroundManagerEvents(['update']);
    const showingScreenIdDataList = getAllShowingScreenIdDataList().filter(
        ([, data]) => data.id === id,
    );
    const { genStyle, element: propsSetting } = useForegroundPropsSetting({
        prefix: 'time-' + id,
        onChange: (extraStyle) => {
            refreshAllTimes(showingScreenIdDataList, extraStyle);
        },
        isFontSize: true,
    });
    return (
        <div className="app-border-white-round p-2">
            {onRemove !== undefined ? (
                <i
                    className="bi bi-x-lg float-end app-caught-hover-pointer"
                    style={{ color: 'red' }}
                    onClick={() => {
                        for (const [
                            screenId,
                            timeData,
                        ] of showingScreenIdDataList) {
                            handleHiding(screenId, timeData);
                        }
                        onRemove();
                    }}
                />
            ) : null}
            {propsSetting}
            <hr />
            <div>
                <TimeInSetComp genStyle={genStyle} id={id} />
            </div>
            <div>
                <ScreensRendererComp
                    showingScreenIdDataList={showingScreenIdDataList}
                    buttonText="`Hide Time"
                    handleForegroundHiding={handleHiding}
                    isMini={false}
                />
            </div>
        </div>
    );
}

function RenderShownMiniComp() {
    useScreenForegroundManagerEvents(['update']);
    const allShowingScreenIdDataList = getAllShowingScreenIdDataList();
    return (
        <ScreensRendererComp
            showingScreenIdDataList={allShowingScreenIdDataList}
            buttonText="`Hide Time"
            genTitle={(data) => {
                return `Time: ${data.id}`;
            }}
            handleForegroundHiding={handleHiding}
            isMini
        />
    );
}

const ID_LIST_SETTING_NAME = 'foreground-time-id-list';
function useIdList() {
    const [idList, setIdList] = useState<string[]>([]);
    const setIdList1 = (newIdList: string[]) => {
        setIdList(newIdList);
        setSetting(ID_LIST_SETTING_NAME, JSON.stringify(newIdList));
    };
    useAppEffect(() => {
        const settingString = getSetting(ID_LIST_SETTING_NAME) ?? '';
        try {
            if (settingString.trim() !== '') {
                setIdList(JSON.parse(settingString));
                return;
            }
        } catch (error) {
            handleError(error);
        }
        setIdList1([crypto.randomUUID()]);
    }, []);
    return [idList, setIdList1] as const;
}

export default function ForegroundTimeComp() {
    const [idList, setIdList] = useIdList();
    return (
        <ForegroundLayoutComp
            target="time"
            fullChildHeaders={<h4>`Time</h4>}
            childHeadersOnHidden={<RenderShownMiniComp />}
        >
            <div className="d-flex flex-wrap gap-1">
                {idList.map((id) => {
                    return (
                        <ForegroundTimeItemComp
                            key={id}
                            id={id}
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
                    className="btn btn-outline-info"
                    title="`Add Time"
                    style={{ width: '20px', padding: '0' }}
                    onClick={() => {
                        setIdList([...idList, crypto.randomUUID()]);
                    }}
                >
                    <i className="bi bi-plus" />
                </button>
            </div>
        </ForegroundLayoutComp>
    );
}
