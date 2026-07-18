import { useCallback, type CSSProperties } from 'react';

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
import type { ForegroundStopwatchDataType } from '../_screen/screenTypeHelpers';
import ForegroundLayoutComp from './ForegroundLayoutComp';
import { dragStore } from '../helper/dragHelpers';
import { genTimeoutAttempt } from '../helper/timeoutHelpers';
import { useAppCurrentRef } from '../helper/appHooks';

const attemptTimeout = genTimeoutAttempt(500);
function refreshAllStopwatches(
    showingScreenIds: [number, ForegroundStopwatchDataType][],
    extraStyle: CSSProperties,
) {
    attemptTimeout(() => {
        for (const [screenId, data] of showingScreenIds) {
            getScreenForegroundManagerInstances(
                screenId,
                (screenForegroundManager) => {
                    screenForegroundManager.setStopwatchData(null);
                    screenForegroundManager.setStopwatchData({
                        ...data,
                        extraStyle,
                    });
                },
            );
        }
    });
}

function handleHiding(screenId: number) {
    getScreenForegroundManagerInstances(screenId, (screenForegroundManager) => {
        screenForegroundManager.setStopwatchData(null);
    });
}

export default function ForegroundStopwatchComp() {
    useScreenForegroundManagerEvents(['update']);
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
    const { genStyle, element: propsSetting } = useForegroundPropsSetting({
        prefix: 'stopwatch',
        onChange: (extraStyle) => {
            refreshAllStopwatches(showingScreenIdDataList, extraStyle);
        },
        isFontSize: true,
    });
    const genHidingElement = (isMini: boolean) => (
        <ScreensRendererComp
            showingScreenIdDataList={showingScreenIdDataList}
            buttonText={tran('Hide Stopwatch')}
            handleForegroundHiding={handleHiding}
            isMini={isMini}
        />
    );
    const handleShowing = useCallback(
        (event: any, isForceChoosing = false) => {
            ScreenForegroundManager.setStopwatch(
                event,
                new Date(),
                genStyle(),
                isForceChoosing,
            );
        },
        [genStyle],
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
            screenForegroundManager.setStopwatchData({
                dateTime: new Date(),
                extraStyle: genStyle(),
            });
        },
        [genStyle],
    );
    const handleByDroppedRef = useAppCurrentRef(handleByDropped);
    const handleDragStart = useCallback(() => {
        dragStore.onDropped = handleByDroppedRef.current;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        <ForegroundLayoutComp
            target="stopwatch"
            fullChildHeaders={<h4>{tran('Stopwatch')}</h4>}
            childHeadersOnHidden={genHidingElement(true)}
            isOnScreen={showingScreenIdDataList.length > 0}
        >
            {propsSetting}
            <hr />
            <div className="app-border-white-round p-2">
                <div className="d-flex align-items-center gap-1 mb-2 text-muted">
                    <i className="bi bi-stopwatch" />
                    <small>{tran('Count up from zero')}</small>
                </div>
                <div className="d-flex">
                    <button
                        className="btn btn-primary"
                        title={tran('Start Stopwatch')}
                        onClick={handleShowing}
                        onContextMenu={handleContextMenuOpening}
                        draggable
                        onDragStart={handleDragStart}
                    >
                        <i className="bi bi-play-fill" />{' '}
                        {tran('Start Stopwatch')}
                    </button>
                </div>
            </div>
            <div className="mt-2">{genHidingElement(false)}</div>
        </ForegroundLayoutComp>
    );
}
