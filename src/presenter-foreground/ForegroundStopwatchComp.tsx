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
import { ForegroundStopwatchDataType } from '../_screen/screenTypeHelpers';
import ForegroundLayoutComp from './ForegroundLayoutComp';
import { dragStore } from '../helper/dragHelpers';

const attemptTimeout = genTimeoutAttempt(500);
function refreshAllStopwatches(
    showingScreenIds: [number, ForegroundStopwatchDataType][],
    extraStyle: React.CSSProperties,
) {
    attemptTimeout(() => {
        showingScreenIds.forEach(([screenId, data]) => {
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
        });
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
    ).map(([screenId, data]) => {
        return [screenId, data.stopwatchData] as [
            number,
            ForegroundStopwatchDataType,
        ];
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
            buttonText="`Hide Stopwatch"
            handleForegroundHiding={handleHiding}
            isMini={isMini}
        />
    );
    const handleShowing = (event: any, isForceChoosing = false) => {
        ScreenForegroundManager.setStopwatch(
            event,
            new Date(),
            genStyle(),
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
        screenForegroundManager.setStopwatchData({
            dateTime: new Date(),
            extraStyle: genStyle(),
        });
    };
    return (
        <ForegroundLayoutComp
            target="stopwatch"
            fullChildHeaders={<h4>`Stopwatch</h4>}
            childHeadersOnHidden={genHidingElement(true)}
        >
            {propsSetting}
            <hr />
            <div>
                <div className="d-flex">
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
                            `Start Stopwatch
                        </button>
                    </div>
                </div>
            </div>
            <div>{genHidingElement(false)}</div>
        </ForegroundLayoutComp>
    );
}
