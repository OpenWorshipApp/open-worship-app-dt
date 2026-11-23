import './foregroundWidgets.scss';

import {
    type DragEvent,
    type MouseEvent,
    type ReactNode,
    type SyntheticEvent,
    useCallback,
    useMemo,
    useRef,
    useState,
} from 'react';

import { tran } from '../lang/langHelpers';
import { useScreenForegroundManagerEvents } from '../_screen/managers/screenEventHelpers';
import ScreenForegroundManager from '../_screen/managers/ScreenForegroundManager';
import type { ForegroundFillDataType } from '../_screen/screenTypeHelpers';
import { withForegroundLayer } from '../_screen/screenTypeHelpers';
import { toTransitionPart } from '../_screen/transitionOverrideHelpers';
import { genTimeoutAttempt } from '../helper/timeoutHelpers';
import { useAppCurrentRef, useAppEffect } from '../helper/appHooks';
import { dragStore, handleDragStart } from '../helper/dragHelpers';
import { useStateSettingBoolean } from '../helper/settingHelpers';
import { genShowOnScreensContextMenu } from '../others/FileItemHandlerComp';
import {
    PaintTargetContext,
    type PaintTargetType,
} from '../others/color/colorSwatchMenuHelpers';
import type {
    FillPickerCustomizeViewType,
    FillPickerScreenViewType,
} from '../background/FillPickerComp';
import {
    toSessionSuffix,
    useMediaSessionAutoPlayRefresh,
} from '../media-sessions/MediaSessionsComp';
import SlideAutoPlayComp, {
    type NextDataType,
} from '../slide-auto-play/SlideAutoPlayComp';
import { getRunningAutoPlayKeys } from '../slide-auto-play/autoPlayRunnerHelpers';
import { genSlideAutoPlaySettingNames } from '../slide-auto-play/slideAutoPlayHelpers';
import { toForegroundAutoPlayPrefix } from './foregroundAutoPlayPrefix';
import {
    stopForegroundPaintAutoPlay,
    syncForegroundPaintAutoPlayRunners,
    tickForegroundPaint,
} from './foregroundPaintAutoPlayHelpers';
import ForegroundLayoutComp from './ForegroundLayoutComp';
import ScreensRendererComp from './ScreensRendererComp';
import {
    getForegroundSessionShowingList,
    getScreenForegroundManagerByDropped,
    getScreenForegroundManagerInstances,
} from './foregroundHelpers';
import {
    genForegroundExtraStyle,
    getForegroundIsBehind,
    useForegroundPropsSetting,
} from './propertiesSettingHelpers';
import { resolveForegroundTransition } from './foregroundTransitionHelpers';
import { genForegroundDragInf } from './foregroundDragHelpers';
import {
    checkIsSessionData,
    toSessionShowingList,
    useForegroundSessions,
} from './foregroundSessionHelpers';
import {
    genPaintCustomizeClosedSettingName,
    getForegroundPropsFlags,
} from './foregroundComponentRules';
import {
    findPressedTile,
    type PressedTileType,
    readPressedTile,
} from '../background/pressedTileHelpers';

/**
 * Fill Show and Animation Show put the Background panel's FILLS and
 * ANIMATIONS on the foreground layer, over the slide (2026-11-15, the user:
 * _add `Fills` and `Animation` to foreground as well_, _make sure it work the
 * same way image show and video show_).
 *
 * So they work as Image Show does: a press shows that fill or animation on
 * the chosen screens and a second press takes it off; several at once come
 * from several **sessions**, each with its own Properties (size, place,
 * opacity, blend, behind or in front, transition) and each owning one item
 * per screen; the Hide row takes this session's down; a tile dragged onto a
 * screen or into a run sheet goes with this session's look. What Image Show
 * picks from a folder these pick from the Background tab's own picker --
 * swatches, gradients, patterns, CSS animations, shaders, saved presets and
 * Customize -- with its drag and its Show on Screens aimed at the foreground
 * (`PaintTargetContext`). And each session runs a slide show of its own, as
 * Image Show does (the user: _`Fills Show` and `Animations Show` should
 * support auto-play as well_): with no folder to walk, it walks the row the
 * one up is in -- the gradients, the patterns, the CSS animations, the
 * shaders or the saved ones (`foregroundPaintAutoPlayHelpers`).
 *
 * While the session has nothing up there is one picker, whose press goes to
 * the screens chosen; once it has one up, a picker per screen holding one --
 * its own lit, its own Customize, its press going to that screen alone -- as
 * the Background tabs split per screen (the user: _it's not split to new
 * section for another screen selected. I drop glsl on another screen, it
 * show customizing for only screen_).
 *
 * The two kinds differ only in their list, their picker and their labels,
 * which the wrappers (`ForegroundFillComp`, `ForegroundAnimationComp`) pass
 * in -- so each lazily loaded panel carries its own picker alone.
 */
export type ForegroundPaintKindType = 'fill' | 'animation';

type PaintListKeyType = 'fillDataList' | 'animationDataList';

export type PaintPickerPropsType = {
    heldSrc: string | null;
    onPick: (src: string | null, event: MouseEvent) => void;
    /** A change made in Customize; none while nothing is held. */
    onEdit?: (src: string) => void;
    /** The one picker, while the session has nothing up. */
    customizeView?: FillPickerCustomizeViewType;
    /** One screen's picker, once the session has one up there. */
    screenView?: FillPickerScreenViewType;
};

// How long after a tile press its focus may still be put back: the press
// swaps the one picker for a picker per screen, unmounting the tile that had
// the keyboard (as in `BackgroundFillsComp`).
const FOCUS_RESTORE_WINDOW_MS = 2000;
const PRESSABLE_SELECTOR =
    '.color-item, .fill-tile, .animation-tile[role="button"]';

function toListKey(kind: ForegroundPaintKindType): PaintListKeyType {
    return kind === 'fill' ? 'fillDataList' : 'animationDataList';
}

function toPaintPrefix(kind: ForegroundPaintKindType, suffix: string) {
    return `${kind}-show${suffix}`;
}

/**
 * One datum for the foreground layer: the fill or animation, which session
 * owns it, and that session's look -- read from the settings when it is
 * PRESSED, so a drag or a run-sheet row carries the look it had then.
 */
function genPaintData(
    kind: ForegroundPaintKindType,
    sessionId: string,
    src: string,
): ForegroundFillDataType {
    const prefix = toPaintPrefix(kind, toSessionSuffix(sessionId));
    const flags = getForegroundPropsFlags(kind);
    return withForegroundLayer(
        {
            src,
            // No key at all for the Default session, as the text widgets
            // write theirs (`putSessionData` reads none as Default).
            ...(sessionId === '' ? {} : { id: sessionId }),
            extraStyle:
                flags === null ? {} : genForegroundExtraStyle(prefix, flags),
            ...toTransitionPart(resolveForegroundTransition(kind, prefix)),
        },
        getForegroundIsBehind(prefix),
    );
}

function hidePaint(
    kind: ForegroundPaintKindType,
    screenId: number,
    data: ForegroundFillDataType,
) {
    getScreenForegroundManagerInstances(screenId, (screenForegroundManager) => {
        screenForegroundManager.removeSessionData(toListKey(kind), data);
    });
}

function presentPaint(
    kind: ForegroundPaintKindType,
    sessionId: string,
    src: string,
    event: any,
    isForceChoosing: boolean,
) {
    ScreenForegroundManager.setData(
        event,
        (screenForegroundManager) => {
            screenForegroundManager.putSessionData(
                toListKey(kind),
                genPaintData(kind, sessionId, src),
            );
        },
        isForceChoosing,
    );
}

/**
 * ONE screen's picker for the session in front: what that screen holds is
 * lit, a press goes to that screen alone (pressing what it holds takes it
 * down), and Customize changes that screen's and no other's.
 */
function PaintScreenPickerComp({
    kind,
    sessionId,
    screenId,
    data,
    compareSrc,
    customizeView,
    renderPicker,
}: Readonly<{
    kind: ForegroundPaintKindType;
    sessionId: string;
    screenId: number;
    data: ForegroundFillDataType;
    compareSrc: (src1: unknown, src2: unknown) => boolean;
    customizeView: FillPickerCustomizeViewType;
    renderPicker: (props: PaintPickerPropsType) => ReactNode;
}>) {
    // Not kept: a fold is for while the panel is open, and a setting per
    // session per screen would only pile up.
    const [isFolded, setIsFolded] = useState(false);
    const dataRef = useAppCurrentRef(data);
    const sessionIdRef = useAppCurrentRef(sessionId);
    const compareSrcRef = useAppCurrentRef(compareSrc);
    const handlePicking = useCallback(
        (src: string | null) => {
            const current = dataRef.current;
            if (src === null || compareSrcRef.current(current.src, src)) {
                hidePaint(kind, screenId, current);
                return;
            }
            getScreenForegroundManagerInstances(
                screenId,
                (screenForegroundManager) => {
                    screenForegroundManager.putSessionData(
                        toListKey(kind),
                        genPaintData(kind, sessionIdRef.current, src),
                    );
                },
            );
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    // Never the one it holds: sent again, it would read as that press.
    const handleEditing = useCallback((src: string) => {
        const current = dataRef.current;
        if (compareSrcRef.current(current.src, src)) {
            return;
        }
        getScreenForegroundManagerInstances(
            screenId,
            (screenForegroundManager) => {
                screenForegroundManager.putSessionData(toListKey(kind), {
                    ...current,
                    src,
                });
            },
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        <div className="p-1 m-1 app-border-white-round">
            {renderPicker({
                heldSrc: data.src,
                onPick: handlePicking,
                onEdit: handleEditing,
                screenView: {
                    screenId,
                    isFolded,
                    onFoldToggle: () => {
                        setIsFolded((value) => {
                            return !value;
                        });
                    },
                    ...customizeView,
                },
            })}
        </div>
    );
}

/**
 * The pickers of ONE session, keyed by it: whether its Customize is closed
 * is that session's own setting, read once per mount and shared by its
 * screens' pickers.
 */
function PaintSessionPickersComp({
    kind,
    sessionId,
    suffix,
    showingList,
    compareSrc,
    onPick,
    renderPicker,
}: Readonly<{
    kind: ForegroundPaintKindType;
    sessionId: string;
    suffix: string;
    showingList: [number, ForegroundFillDataType][];
    compareSrc: (src1: unknown, src2: unknown) => boolean;
    onPick: (src: string | null, event: MouseEvent) => void;
    renderPicker: (props: PaintPickerPropsType) => ReactNode;
}>) {
    const [isCustomizeClosed, setIsCustomizeClosed] = useStateSettingBoolean(
        genPaintCustomizeClosedSettingName(kind, suffix),
    );
    const customizeView: FillPickerCustomizeViewType = {
        isCustomizeClosed,
        onCustomizeToggle: () => {
            setIsCustomizeClosed((value) => {
                return !value;
            });
        },
    };
    if (showingList.length === 0) {
        return renderPicker({ heldSrc: null, onPick, customizeView });
    }
    // A session owns one per screen; the first is kept should two arrive.
    const screenDataList = showingList
        .filter(([screenId], index) => {
            return (
                showingList.findIndex(([otherId]) => {
                    return otherId === screenId;
                }) === index
            );
        })
        .sort(([screenId1], [screenId2]) => {
            return screenId1 - screenId2;
        });
    return screenDataList.map(([screenId, data]) => {
        return (
            <PaintScreenPickerComp
                // Keyed by the SCREEN: a change of what it holds keeps the
                // picker, and the keyboard focus in it.
                key={screenId}
                kind={kind}
                sessionId={sessionId}
                screenId={screenId}
                data={data}
                compareSrc={compareSrc}
                customizeView={customizeView}
                renderPicker={renderPicker}
            />
        );
    });
}

export default function ForegroundPaintShowComp({
    kind,
    hideLabel,
    genLabel,
    compareSrc,
    renderPicker,
}: Readonly<{
    kind: ForegroundPaintKindType;
    /** Already translated: the Hide row's button. */
    hideLabel: string;
    /** A fill's or an animation's name, translated, for the Hide row. */
    genLabel: (src: string) => string;
    compareSrc: (src1: unknown, src2: unknown) => boolean;
    renderPicker: (props: PaintPickerPropsType) => ReactNode;
}>) {
    useScreenForegroundManagerEvents(['update']);
    const listKey = toListKey(kind);
    // Every session's overlay of this kind, one row each.
    const showingScreenIdDataList = getForegroundSessionShowingList(listKey);
    const showingRef = useAppCurrentRef(showingScreenIdDataList);
    // The ▶ on a chip follows the show, not whatever next redraws the panel.
    useMediaSessionAutoPlayRefresh();
    const runningAutoPlayKeys = getRunningAutoPlayKeys();
    const {
        activeId,
        sessionIds,
        suffix,
        prefix,
        element: sessionsElement,
    } = useForegroundSessions({
        widgetKey: kind,
        toPrefix: (sessionSuffix) => {
            return toPaintPrefix(kind, sessionSuffix);
        },
        toOwnSettingNames: (sessionSuffix) => {
            return [
                genPaintCustomizeClosedSettingName(kind, sessionSuffix),
                ...genSlideAutoPlaySettingNames(
                    toForegroundAutoPlayPrefix(kind, sessionSuffix),
                ),
            ];
        },
        checkIsOnScreen: (sessionId, _suffix, idList) => {
            return showingScreenIdDataList.some(([, data]) => {
                return checkIsSessionData(data, sessionId, idList);
            });
        },
        hideSession: (sessionId, sessionSuffix, idList) => {
            stopForegroundPaintAutoPlay(kind, sessionSuffix);
            for (const [screenId, data] of showingRef.current) {
                if (checkIsSessionData(data, sessionId, idList)) {
                    hidePaint(kind, screenId, data);
                }
            }
        },
        // ANDed with what is on screen, as Image Show's chip is: a show
        // that ended inside its own timer is no render, and the ▶ stayed.
        checkIsAutoPlaying: (sessionId, sessionSuffix, sessionIdList) => {
            return (
                runningAutoPlayKeys.includes(
                    toForegroundAutoPlayPrefix(kind, sessionSuffix),
                ) &&
                showingScreenIdDataList.some(([, data]) => {
                    return checkIsSessionData(data, sessionId, sessionIdList);
                })
            );
        },
    });
    // What THIS session has up: what its picker shows as held, what its
    // Properties and Customize change, and what its Hide row offers.
    const sessionShowingList = toSessionShowingList(
        showingScreenIdDataList,
        activeId,
        sessionIds,
    );
    const sessionShowingRef = useAppCurrentRef(sessionShowingList);
    const activeIdRef = useAppCurrentRef(activeId);
    // Per instance: one timer per panel, never shared with the other kind.
    const attemptTimeout = useMemo(() => {
        return genTimeoutAttempt(500);
    }, []);
    const flags = getForegroundPropsFlags(kind);
    const { element: propsSetting } = useForegroundPropsSetting({
        prefix,
        widgetKey: kind,
        isFontSize: flags?.isFontSize,
        isGeometry: flags?.isGeometry,
        isCommonStyle: flags?.isCommonStyle,
        isBlendMode: flags?.isBlendMode,
        onChange: (extraStyle, isBehind) => {
            attemptTimeout(() => {
                for (const [screenId, data] of sessionShowingRef.current) {
                    getScreenForegroundManagerInstances(
                        screenId,
                        (screenForegroundManager) => {
                            screenForegroundManager.putSessionData(
                                listKey,
                                withForegroundLayer(
                                    { ...data, extraStyle },
                                    isBehind,
                                ),
                            );
                        },
                    );
                }
            });
        },
    });
    // A press while the session has nothing up: it goes up on the screens
    // chosen. Once it has, each screen's picker takes its own presses.
    const handlePicking = useCallback(
        (src: string | null, event: MouseEvent) => {
            if (src === null) {
                return;
            }
            presentPaint(kind, activeIdRef.current, src, event, false);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    // Every render that changes what is up reconciles the module-level
    // timers: pressing Play, putting one up and taking one down all land
    // here, and a show whose panel is closed keeps the timer it has.
    useAppEffect(() => {
        syncForegroundPaintAutoPlayRunners(kind);
    }, [kind, activeId, showingScreenIdDataList.length]);
    const handleAutoPlayStateChange = useCallback(() => {
        syncForegroundPaintAutoPlayRunners(kind);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    // The clock is external, so this is the control's own step: the
    // runner's tick, so the two never walk different rows.
    const handleNext = useCallback((data: NextDataType) => {
        return tickForegroundPaint(kind, activeIdRef.current, data.isNext);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const listRef = useRef<HTMLDivElement | null>(null);
    const pressedTileRef = useRef<PressedTileType | null>(null);
    const handleTilePressing = useCallback((event: SyntheticEvent) => {
        pressedTileRef.current = readPressedTile(
            event.target as HTMLElement,
            PRESSABLE_SELECTOR,
        );
    }, []);
    const screenIdsKey = sessionShowingList
        .map(([screenId]) => {
            return screenId;
        })
        .join(',');
    useAppEffect(() => {
        const pressed = pressedTileRef.current;
        const list = listRef.current;
        if (pressed === null || list === null) {
            return;
        }
        if (Date.now() - pressed.at > FOCUS_RESTORE_WINDOW_MS) {
            pressedTileRef.current = null;
            return;
        }
        const activeElement = document.activeElement;
        if (activeElement !== null && activeElement !== document.body) {
            return;
        }
        pressedTileRef.current = null;
        findPressedTile(list, PRESSABLE_SELECTOR, pressed)?.focus();
    }, [screenIdsKey]);
    const paintTarget = useMemo<PaintTargetType>(() => {
        return {
            handleDragStart: (event: DragEvent, src: string) => {
                const genData = () => {
                    return genPaintData(kind, activeIdRef.current, src);
                };
                dragStore.onDropped = (droppedEvent: any) => {
                    const screenForegroundManager =
                        getScreenForegroundManagerByDropped(droppedEvent);
                    if (screenForegroundManager === null) {
                        return;
                    }
                    screenForegroundManager.putSessionData(listKey, genData());
                };
                handleDragStart(event, genForegroundDragInf(kind, genData));
            },
            genShowOnScreensMenuItems: (src: string) => {
                return genShowOnScreensContextMenu((menuEvent) => {
                    presentPaint(
                        kind,
                        activeIdRef.current,
                        src,
                        menuEvent,
                        true,
                    );
                });
            },
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const genLabelRef = useAppCurrentRef(genLabel);
    const genTitle = useCallback((data: ForegroundFillDataType) => {
        return genLabelRef.current(data.src);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleHiding = useCallback(
        (screenId: number, data: ForegroundFillDataType) => {
            hidePaint(kind, screenId, data);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    return (
        <ForegroundLayoutComp
            target={kind}
            extraBodyClassName="foreground-media-body"
        >
            <div className="foreground-media-bar d-flex align-items-center flex-wrap gap-2">
                {sessionsElement}
                {propsSetting}
                {/* Up here with the Hide row, as Image Show's is: a show
                    needs something up to start from. */}
                {sessionShowingList.length > 0 ? (
                    <SlideAutoPlayComp
                        // Its play state and rules are read once per mount.
                        key={activeId}
                        prefix={toForegroundAutoPlayPrefix(kind, suffix)}
                        onNext={handleNext}
                        isTimerExternal
                        isInline
                        onStateChange={handleAutoPlayStateChange}
                    />
                ) : null}
                <ScreensRendererComp
                    showingScreenIdDataList={sessionShowingList}
                    buttonText={hideLabel}
                    genTitle={genTitle}
                    handleForegroundHiding={handleHiding}
                    isMini
                />
            </div>
            <div
                ref={listRef}
                className="foreground-media-list"
                onClickCapture={handleTilePressing}
            >
                <PaintTargetContext value={paintTarget}>
                    <PaintSessionPickersComp
                        // Keyed by session: its Customize state is its own.
                        key={activeId}
                        kind={kind}
                        sessionId={activeId}
                        suffix={suffix}
                        showingList={sessionShowingList}
                        compareSrc={compareSrc}
                        onPick={handlePicking}
                        renderPicker={renderPicker}
                    />
                </PaintTargetContext>
            </div>
        </ForegroundLayoutComp>
    );
}

/** The Hide row's words, as literals for `tranKeyCoverage`. */
export function genPaintHideLabel(kind: ForegroundPaintKindType) {
    return kind === 'fill' ? tran('Hide Fill') : tran('Hide Animation');
}
