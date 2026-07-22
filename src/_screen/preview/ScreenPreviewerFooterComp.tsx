import { lazy, useCallback, useState } from 'react';

import { tran } from '../../lang/langHelpers';
import {
    useScreenManagerBaseContext,
    useScreenManagerContext,
    useScreenVideoSources,
} from '../managers/screenManagerHooks';
import DisplayControl from './DisplayControl';
import ScreenEffectControlComp from './ScreenEffectControlComp';
import type { ContextMenuItemType } from '../../context-menu/appContextMenuHelpers';
import { showAppContextMenu } from '../../context-menu/appContextMenuHelpers';
import AppSuspenseComp from '../../others/AppSuspenseComp';
import { showSimpleToast } from '../../toast/toastHelpers';
import { useAppCurrentRef } from '../../helper/appHooks';
import { checkMediaPlaying } from '../../helper/mediaControlHelpers';
import { useStateSettingString } from '../../helper/settingHelpers';
import type { DrawModeType } from '../screenTypeHelpers';

const LazyMiniScreenAudioHandlersComp = lazy(() => {
    return import('./MiniScreenAudioHandlersComp');
});

const LazyMiniScreenDrawHandlersComp = lazy(() => {
    return import('./MiniScreenDrawHandlersComp');
});

const LazyMiniScreenFocusHandlersComp = lazy(() => {
    return import('./MiniScreenFocusHandlersComp');
});

function getNewStageNumber(
    event: any,
    currentStageNumber: number,
    onChange: (newStageNumber: number) => void,
) {
    const items: ContextMenuItemType[] = Array.from(
        { length: 5 },
        (_, i) => i,
    ).map((i) => {
        return {
            menuElement: `${i}`,
            disabled: i === currentStageNumber,
            onSelect: () => {
                onChange(i);
            },
        };
    });
    items.push(
        {
            menuElement: tran('Decrement'),
            disabled: currentStageNumber <= 0,
            onSelect: () => {
                onChange(Math.max(0, currentStageNumber - 1));
            },
        },
        {
            menuElement: tran('Increment'),
            onSelect: () => {
                onChange(currentStageNumber + 1);
            },
        },
    );
    showAppContextMenu(event, items);
}

function BackgroundAudioSwitchComp({
    isAudioHandlersVisible,
    setIsAudioHandlersVisible,
}: Readonly<{
    isAudioHandlersVisible: boolean;
    setIsAudioHandlersVisible: (isVisible: boolean) => void;
}>) {
    const isAudioHandlersVisibleRef = useAppCurrentRef(isAudioHandlersVisible);
    const setIsAudioHandlersVisibleRef = useAppCurrentRef(
        setIsAudioHandlersVisible,
    );
    const handleToggleAudioHandlers = useCallback(() => {
        if (isAudioHandlersVisibleRef.current) {
            const isPlaying = checkMediaPlaying({
                query: 'audio[data-video-id]',
                withMessage: false,
            });
            if (isPlaying) {
                showSimpleToast(
                    tran('Audio is Playing'),
                    tran(
                        'Please pause all background audios before disabling audio handlers',
                    ),
                );
                return;
            }
        }
        setIsAudioHandlersVisibleRef.current(
            !isAudioHandlersVisibleRef.current,
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        <button
            className={`btn btn-sm btn-${isAudioHandlersVisible ? 'primary' : 'outline-secondary'}`}
            onClick={handleToggleAudioHandlers}
            title={tran('Enable Background Audio Handlers')}
            aria-label={tran('Enable Background Audio Handlers')}
        >
            <i className="bi bi-soundwave" />
        </button>
    );
}

// The two draw controls, in 3-dots menu order. Icon doubles as the toggle
// button's face so the button always shows which one it will turn on.
const drawModeInfoList: {
    mode: DrawModeType;
    icon: string;
    title: string;
}[] = [
    { mode: 'paint', icon: 'bi-brush', title: 'Drawing' },
    { mode: 'focus', icon: 'bi-record-circle', title: 'Focusing' },
];

function DrawSwitchComp({
    isDrawHandlersVisible,
    setIsDrawHandlersVisible,
    drawMode,
    setDrawMode,
}: Readonly<{
    isDrawHandlersVisible: boolean;
    setIsDrawHandlersVisible: (isVisible: boolean) => void;
    drawMode: DrawModeType;
    setDrawMode: (drawMode: DrawModeType) => void;
}>) {
    const { screenDrawManager, screenFocusManager } = useScreenManagerContext();
    const screenDrawManagerRef = useAppCurrentRef(screenDrawManager);
    const screenFocusManagerRef = useAppCurrentRef(screenFocusManager);
    const isDrawHandlersVisibleRef = useAppCurrentRef(isDrawHandlersVisible);
    const setIsDrawHandlersVisibleRef = useAppCurrentRef(
        setIsDrawHandlersVisible,
    );
    const drawModeRef = useAppCurrentRef(drawMode);
    // The on/off state is ONE user-level idea ("this screen's overlay panel is
    // on"), but each control persists it in its own manager — Drawing in
    // `isDrawEnabled` (inside the draw blob), Focusing in `isPanelOpen`. Push it
    // into whichever one owns the given mode, so what reopens after a reload is
    // the control that was actually showing.
    const applyEnabledState = useCallback(
        (mode: DrawModeType, isEnabled: boolean) => {
            if (mode === 'focus') {
                // Nothing to arm here: the focus panel arms its own overlay on
                // mount, and arming the draw canvas as well would just fight it
                // for pointer input.
                screenFocusManagerRef.current?.setIsPanelOpen(isEnabled);
                return;
            }
            if (isEnabled) {
                // Enable also requests the group's existing drawing.
                screenDrawManagerRef.current.enableDraw();
            } else {
                screenDrawManagerRef.current.disableDraw();
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    const handleToggleDrawHandlers = useCallback(() => {
        const isEnabling = !isDrawHandlersVisibleRef.current;
        setIsDrawHandlersVisibleRef.current(isEnabling);
        if (isEnabling) {
            applyEnabledState(drawModeRef.current, true);
            return;
        }
        // Off is off, WHICHEVER control is showing — so turning off always tears
        // down BOTH. Skipping the draw layer for Focusing stranded any drawing
        // made before the mode switch: the strokes stayed on screen with no
        // visible way to clear them, since the focus panel has no Clear and this
        // button is the only other control. Disabling the drawing clears it only
        // if no other group member still has draw enabled.
        screenFocusManagerRef.current?.setIsPanelOpen(false);
        screenDrawManagerRef.current.disableDraw();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const setDrawModeRef = useAppCurrentRef(setDrawMode);
    // Picks WHICH control is shown. It must not CHANGE the on/off state — an
    // enabled Drawing becomes an enabled Focusing, a disabled one stays disabled
    // — but it does re-home where that state is persisted, or a panel enabled
    // before the switch would come back closed on the next launch.
    const handleShowDrawOptions = useCallback((event: any) => {
        const items: ContextMenuItemType[] = drawModeInfoList.map(
            ({ mode, icon, title }) => {
                return {
                    menuElement: (
                        <span>
                            <i className={`bi ${icon} me-2`} />
                            {tran(title)}
                        </span>
                    ),
                    disabled: mode === drawModeRef.current,
                    onSelect: () => {
                        setDrawModeRef.current(mode);
                        applyEnabledState(
                            mode,
                            isDrawHandlersVisibleRef.current,
                        );
                    },
                };
            },
        );
        showAppContextMenu(event, items);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    // Looked up by value, not by index: a persisted setting is untrusted input,
    // and an unknown mode must fall back to Drawing rather than read past the
    // end of the list.
    const drawModeInfo =
        drawModeInfoList.find(({ mode }) => {
            return mode === drawMode;
        }) ?? drawModeInfoList[0];
    const toggleTitle = `${tran('Enable')} ${tran(drawModeInfo.title)}`;
    const optionsTitle = tran('Choose Drawing or Focusing');
    return (
        <div className="btn-group">
            <button
                className={`btn btn-sm btn-${isDrawHandlersVisible ? 'primary' : 'outline-secondary'}`}
                style={{
                    width: 25,
                }}
                onClick={handleToggleDrawHandlers}
                title={toggleTitle}
                aria-label={toggleTitle}
            >
                <i className={`bi ${drawModeInfo.icon}`} />
            </button>
            <button
                className="btn btn-sm btn-outline-secondary p-0"
                onClick={handleShowDrawOptions}
                title={optionsTitle}
                aria-label={optionsTitle}
            >
                <i className="bi bi-three-dots-vertical" />
            </button>
        </div>
    );
}

export default function ScreenPreviewerFooterComp() {
    const [isAudioHandlersVisible, setIsAudioHandlersVisible] = useState(false);
    const screenManager = useScreenManagerContext();
    // Restore the draw panel's on/off state persisted for this screen.
    // Which overlay control the panel shows. Persisted per screen so the
    // previewer reopens on the one that was last used; independent of the on/off
    // state below, which switching must never touch.
    const [drawMode, setDrawMode] = useStateSettingString<DrawModeType>(
        `screen-draw-mode-${screenManager.screenId}`,
        'paint',
    );
    // Seeded from whichever manager persists the on/off state for the restored
    // mode (the `?.` matters — preview test mocks omit these managers).
    const [isDrawHandlersVisible, setIsDrawHandlersVisible] = useState(() => {
        return drawMode === 'focus'
            ? (screenManager.screenFocusManager?.isPanelOpen ?? false)
            : (screenManager.screenDrawManager?.isDrawEnabled ?? false);
    });
    const videoSources = useScreenVideoSources();
    const screenManagerBase = useScreenManagerBaseContext();
    const [stageNumber, setStageNumber] = useState(
        screenManagerBase.stageNumber,
    );
    const screenManagerBaseRef = useAppCurrentRef(screenManagerBase);
    const setStageNumber1 = useCallback(
        (newStageNumber: number) => {
            screenManagerBaseRef.current.stageNumber = newStageNumber;
            setStageNumber(newStageNumber);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    const stageNumberRef = useAppCurrentRef(stageNumber);
    const setStageNumber1Ref = useAppCurrentRef(setStageNumber1);
    const handleStageNumberChange = useCallback((event: any) => {
        getNewStageNumber(
            event,
            stageNumberRef.current,
            setStageNumber1Ref.current,
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        <div
            className="card-footer w-100"
            style={{
                overflowX: 'auto',
                padding: '1px',
            }}
        >
            <div
                className="d-flex w-100 "
                style={{
                    height: '25px',
                    overflowY: 'hidden',
                }}
            >
                <div className="d-flex justify-content-start">
                    <div>
                        <DisplayControl />
                    </div>
                    <ScreenEffectControlComp />
                    {videoSources.length > 0 ? (
                        <div>
                            <BackgroundAudioSwitchComp
                                isAudioHandlersVisible={isAudioHandlersVisible}
                                setIsAudioHandlersVisible={
                                    setIsAudioHandlersVisible
                                }
                            />
                        </div>
                    ) : null}
                    <div className="ms-1">
                        <DrawSwitchComp
                            isDrawHandlersVisible={isDrawHandlersVisible}
                            setIsDrawHandlersVisible={setIsDrawHandlersVisible}
                            drawMode={drawMode}
                            setDrawMode={setDrawMode}
                        />
                    </div>
                </div>
                <div
                    className="flex-grow-1 d-flex justify-content-end"
                    title={tran('Stage')}
                >
                    <div
                        className="d-flex app-caught-hover-pointer"
                        title={`${tran('Stage')}: ${tran('Click to change Stage Number')}`}
                        onClick={handleStageNumberChange}
                    >
                        <small>St:</small>
                        <div className="px-1 text-muted">{stageNumber}</div>
                    </div>
                </div>
            </div>
            {videoSources.length > 0 && isAudioHandlersVisible ? (
                <AppSuspenseComp>
                    <div className="w-100">
                        {videoSources.map(([videoSource, videoId]) => (
                            <LazyMiniScreenAudioHandlersComp
                                key={videoSource}
                                src={videoSource}
                                videoId={videoId}
                            />
                        ))}
                    </div>
                </AppSuspenseComp>
            ) : null}
            {isDrawHandlersVisible ? (
                <AppSuspenseComp>
                    {drawMode === 'focus' ? (
                        <LazyMiniScreenFocusHandlersComp />
                    ) : (
                        <LazyMiniScreenDrawHandlersComp />
                    )}
                </AppSuspenseComp>
            ) : null}
        </div>
    );
}
