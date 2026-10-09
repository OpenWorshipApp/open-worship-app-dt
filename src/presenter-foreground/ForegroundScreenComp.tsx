import { useCallback, useMemo, type CSSProperties } from 'react';

import ContextMenuDotsButtonComp from '../context-menu/ContextMenuDotsButtonComp';
import { tran } from '../lang/langHelpers';
import { useAppCurrentRef } from '../helper/appHooks';
import ScreenForegroundManager from '../_screen/managers/ScreenForegroundManager';
import {
    getScreenForegroundManagerInstances,
    getForegroundShowingScreenIdDataList,
    getScreenForegroundManagerByDropped,
} from './foregroundHelpers';
import ScreensRendererComp from './ScreensRendererComp';
import { useScreenForegroundManagerEvents } from '../_screen/managers/screenEventHelpers';
import { useScreenManagerEvents } from '../_screen/managers/screenManagerHooks';
import {
    getAllScreenManagerBases,
    getScreenManagerBase,
} from '../_screen/managers/screenManagerBaseHelpers';
import {
    getForegroundIsBehind,
    useForegroundPropsSetting,
} from './propertiesSettingHelpers';
import { resolveForegroundTransition } from './foregroundTransitionHelpers';
import { toTransitionPart } from '../_screen/transitionOverrideHelpers';
import {
    type ForegroundScreenDataType,
    withForegroundLayer,
} from '../_screen/screenTypeHelpers';
import ForegroundLayoutComp from './ForegroundLayoutComp';
import { dragStore, handleDragStart } from '../helper/dragHelpers';
import { genForegroundDragInf } from './foregroundDragHelpers';
import { genTimeoutAttempt } from '../helper/timeoutHelpers';
import { genColorFromScreenId } from '../_screen/preview/screenIdColorHelpers';

/**
 * The settings prefix of the card that shows screen `screenId`: its
 * Properties, its transition and its layer. `screen-show-`, never `screen-`:
 * those keys belong to the screen that OWNS them (its display, its drawing,
 * its spotlight) and are swept when that screen is deleted.
 */
function toScreenShowPrefix(screenId: number) {
    return `screen-show-${screenId}`;
}

function genScreenShowData(
    screenId: number,
    extraStyle: CSSProperties,
): ForegroundScreenDataType {
    const prefix = toScreenShowPrefix(screenId);
    return withForegroundLayer(
        {
            id: screenId,
            extraStyle,
            ...toTransitionPart(resolveForegroundTransition('screen', prefix)),
        },
        getForegroundIsBehind(prefix),
    );
}

/**
 * The card's picture: NOT a live one. A live thumbnail of every screen would
 * draw every screen once more for as long as the panel is open; the screen's
 * identity colour and number are what an operator recognises it by anyway,
 * the same as its Mini Screen badge. Whether that screen is showing does not
 * matter: its content is drawn from what it holds, shown or hidden.
 */
function RenderScreenInfoComp({
    screenId,
    width,
    genStyle,
}: Readonly<{
    screenId: number;
    width: number;
    genStyle: () => CSSProperties;
}>) {
    const screenManagerBase = getScreenManagerBase(screenId);
    const title = `${tran('Screen')}: ${screenId}`;
    const handleShowing = useCallback(
        (event: any, isForceChoosing = false) => {
            ScreenForegroundManager.addScreenData(
                event,
                genScreenShowData(screenId, genStyle()),
                isForceChoosing,
            );
        },
        [screenId, genStyle],
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
            screenForegroundManager.addScreenData(
                genScreenShowData(screenId, genStyle()),
            );
        },
        [screenId, genStyle],
    );
    const handleByDroppedRef = useAppCurrentRef(handleByDropped);
    const screenIdRef = useAppCurrentRef(screenId);
    const genStyleRef = useAppCurrentRef(genStyle);
    const handleDraggingStart = useCallback((event: any) => {
        dragStore.onDropped = handleByDroppedRef.current;
        handleDragStart(
            event,
            genForegroundDragInf('screen', () => {
                return genScreenShowData(
                    screenIdRef.current,
                    genStyleRef.current(),
                );
            }),
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        <div className="card m-1" style={{ width: `${width}px` }}>
            <div
                className="card-header app-ellipsis d-flex align-items-center"
                title={title}
            >
                <span className="flex-fill app-ellipsis">{title}</span>
                <ContextMenuDotsButtonComp
                    label={tran('Show on Screens')}
                    onOpening={handleContextMenuOpening}
                />
            </div>
            <div
                className={
                    'card-body w-100 p-0 app-overflow-hidden' +
                    ' app-caught-hover-pointer'
                }
                data-screen-id={screenId}
                onClick={handleShowing}
                onContextMenu={handleContextMenuOpening}
                draggable
                onDragStart={handleDraggingStart}
            >
                {/*
                 * Its own box, not the card body's background: a floating
                 * panel makes every `.card-body` transparent, `!important`.
                 */}
                <div
                    className={
                        'w-100 d-flex flex-column align-items-center' +
                        ' justify-content-center'
                    }
                    style={{
                        aspectRatio: screenManagerBase
                            ? `${screenManagerBase.width} / ${screenManagerBase.height}`
                            : '16 / 9',
                        backgroundColor: genColorFromScreenId(screenId),
                        color: '#ffffff',
                    }}
                >
                    <span style={{ fontSize: '3em', fontWeight: 'bold' }}>
                        {screenId}
                    </span>
                </div>
            </div>
        </div>
    );
}

function getAllShowingScreenIdDataList() {
    return getForegroundShowingScreenIdDataList(({ screenDataList }) => {
        return screenDataList.length > 0;
    }).reduce(
        (acc, [screenId, { screenDataList }]) => {
            return acc.concat(
                screenDataList.map((data) => {
                    return [screenId, data];
                }),
            );
        },
        [] as [number, ForegroundScreenDataType][],
    );
}

// One datum per source per screen, so a changed one simply REPLACES the old
// (`addScreenData`): one save and one redraw rather than a remove and an add.
function refreshAllScreenShows(
    showingScreenIdDataList: [number, ForegroundScreenDataType][],
    extraStyle: CSSProperties,
    isBehind: boolean,
) {
    for (const [screenId, data] of showingScreenIdDataList) {
        getScreenForegroundManagerInstances(
            screenId,
            (screenForegroundManager) => {
                screenForegroundManager.addScreenData(
                    withForegroundLayer({ ...data, extraStyle }, isBehind),
                );
            },
        );
    }
}

function handleScreenShowHiding(
    screenId: number,
    data: ForegroundScreenDataType,
) {
    getScreenForegroundManagerInstances(screenId, (screenForegroundManager) => {
        screenForegroundManager.removeScreenData(data);
    });
}

function ForegroundScreenItemComp({
    screenId,
}: Readonly<{
    screenId: number;
}>) {
    useScreenForegroundManagerEvents(['update']);
    const showingScreenIdDataList = getAllShowingScreenIdDataList().filter(
        ([, data]) => data.id === screenId,
    );
    // per-instance: one item per source screen -- a shared module timer
    // would drop the earlier screen's refresh when two are adjusted within
    // 500ms
    const attemptTimeout = useMemo(() => genTimeoutAttempt(500), []);
    const prefix = toScreenShowPrefix(screenId);
    const { genStyle, element: propsSetting } = useForegroundPropsSetting({
        prefix,
        // A picture with no words of its own, like Video and Image Show: no
        // text colour, font, or the text widgets' tinted, blurred backing --
        // where the other screen draws nothing, this one shows through.
        isCommonStyle: false,
        isBlendMode: true,
        widgetKey: 'screen',
        onChange: (extraStyle, isBehind) => {
            attemptTimeout(() => {
                refreshAllScreenShows(
                    showingScreenIdDataList,
                    extraStyle,
                    isBehind,
                );
            });
        },
    });
    return (
        <ForegroundLayoutComp
            target={prefix}
            // Kept, for the same reason as the cameras: one of these per
            // screen, in a list.
            extraBodyClassName="app-border-white-round p-1"
            extraBodyStyle={{ margin: '2px' }}
        >
            {propsSetting}
            <div className="fg-body">
                <div className="d-flex flex-wrap">
                    <RenderScreenInfoComp
                        screenId={screenId}
                        width={200}
                        genStyle={genStyle}
                    />
                </div>
                {showingScreenIdDataList.length > 0 ? (
                    <div className="fg-actions">
                        <ScreensRendererComp
                            showingScreenIdDataList={showingScreenIdDataList}
                            buttonText={tran('Hide Screen Show')}
                            genTitle={(data) => {
                                return `${tran('Screen')}: ${data.id}`;
                            }}
                            handleForegroundHiding={handleScreenShowHiding}
                            isMini={false}
                        />
                    </div>
                ) : null}
            </div>
        </ForegroundLayoutComp>
    );
}

export default function ForegroundScreenComp() {
    // A screen added, deleted, shown, hidden or regrouped changes the cards.
    useScreenManagerEvents(['instance', 'visible', 'color-note-update']);
    useScreenForegroundManagerEvents(['update']);
    const screenIds = getAllScreenManagerBases().map((screenManagerBase) => {
        return screenManagerBase.screenId;
    });
    return (
        <ForegroundLayoutComp target="screen">
            <div className="d-flex flex-wrap">
                {screenIds.map((screenId) => {
                    return (
                        <ForegroundScreenItemComp
                            key={screenId}
                            screenId={screenId}
                        />
                    );
                })}
            </div>
        </ForegroundLayoutComp>
    );
}
