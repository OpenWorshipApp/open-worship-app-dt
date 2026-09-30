import { useCallback, useMemo, type CSSProperties } from 'react';

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
import type { ForegroundStopwatchDataType } from '../_screen/screenTypeHelpers';
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

function refreshAllStopwatches(
    showingScreenIds: [number, ForegroundStopwatchDataType][],
    extraStyle: CSSProperties,
) {
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
}

function handleHiding(screenId: number) {
    getScreenForegroundManagerInstances(screenId, (screenForegroundManager) => {
        screenForegroundManager.setStopwatchData(null);
    });
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
        prefix,
        element: sessionsElement,
    } = useForegroundSessions({
        widgetKey: 'stopwatch',
        toPrefix: (suffix) => {
            return `stopwatch${suffix}`;
        },
        checkIsOnScreen: (sessionId) => {
            return showingScreenIdDataList.some(([, data]) => {
                return checkIsSessionData(data, sessionId);
            });
        },
        hideSession: (sessionId) => {
            for (const [screenId, data] of showingRef.current) {
                if (checkIsSessionData(data, sessionId)) {
                    handleHiding(screenId);
                }
            }
        },
    });
    const { genStyle, element: propsSetting } = useForegroundPropsSetting({
        prefix,
        onChange: (extraStyle) => {
            attemptTimeout(() => {
                // THIS session's stopwatch only. `activeId` is read from the
                // render the control was touched in, not at fire time: the
                // change belongs to the session it was made on even if the
                // strip is switched inside the half-second.
                refreshAllStopwatches(
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
                activeId,
            );
        },
        [genStyle, activeId],
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
                // The session rides a LIVE drop from this panel, which is this
                // session acting. A run-sheet row replayed weeks later carries
                // none -- see `applyForegroundDragData`.
                id: activeId || undefined,
                dateTime: new Date(),
                extraStyle: genStyle(),
            });
        },
        [genStyle, activeId],
    );
    const handleByDroppedRef = useAppCurrentRef(handleByDropped);
    const genStyleRef = useAppCurrentRef(genStyle);
    const handleDraggingStart = useCallback((event: any) => {
        dragStore.onDropped = handleByDroppedRef.current;
        handleDragStart(
            event,
            genForegroundDragInf('stopwatch', () => {
                return { extraStyle: genStyleRef.current() };
            }),
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
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
                <div className="fg-actions">
                    <button
                        className="btn btn-primary"
                        title={tran('Start Stopwatch')}
                        onClick={handleShowing}
                        onContextMenu={handleContextMenuOpening}
                        draggable
                        onDragStart={handleDraggingStart}
                    >
                        <i className="bi bi-play-fill" />{' '}
                        {tran('Start Stopwatch')}
                    </button>
                    <ContextMenuDotsButtonComp
                        label={tran('Show on Screens')}
                        onOpening={handleContextMenuOpening}
                    />
                    {genHidingElement(false)}
                </div>
            </div>
        </ForegroundLayoutComp>
    );
}
