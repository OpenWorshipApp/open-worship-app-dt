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

const LazyMiniScreenAudioHandlersComp = lazy(() => {
    return import('./MiniScreenAudioHandlersComp');
});

const LazyMiniScreenDrawHandlersComp = lazy(() => {
    return import('./MiniScreenDrawHandlersComp');
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

function DrawSwitchComp({
    isDrawHandlersVisible,
    setIsDrawHandlersVisible,
}: Readonly<{
    isDrawHandlersVisible: boolean;
    setIsDrawHandlersVisible: (isVisible: boolean) => void;
}>) {
    const { screenDrawManager } = useScreenManagerContext();
    const screenDrawManagerRef = useAppCurrentRef(screenDrawManager);
    const isDrawHandlersVisibleRef = useAppCurrentRef(isDrawHandlersVisible);
    const setIsDrawHandlersVisibleRef = useAppCurrentRef(
        setIsDrawHandlersVisible,
    );
    const handleToggleDrawHandlers = useCallback(() => {
        const isEnabling = !isDrawHandlersVisibleRef.current;
        setIsDrawHandlersVisibleRef.current(isEnabling);
        // Enable requests the group's existing drawing; disable clears only if
        // no other group member still has draw enabled.
        if (isEnabling) {
            screenDrawManagerRef.current.enableDraw();
        } else {
            screenDrawManagerRef.current.disableDraw();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        <button
            className={`btn btn-sm btn-${isDrawHandlersVisible ? 'primary' : 'outline-secondary'}`}
            onClick={handleToggleDrawHandlers}
            title={tran('Enable Drawing')}
            aria-label={tran('Enable Drawing')}
        >
            <i className="bi bi-brush" />
        </button>
    );
}

export default function ScreenPreviewerFooterComp() {
    const [isAudioHandlersVisible, setIsAudioHandlersVisible] = useState(false);
    const screenManager = useScreenManagerContext();
    // Restore the draw panel's on/off state persisted for this screen.
    const [isDrawHandlersVisible, setIsDrawHandlersVisible] = useState(
        screenManager.screenDrawManager?.isDrawEnabled ?? false,
    );
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
                    <LazyMiniScreenDrawHandlersComp />
                </AppSuspenseComp>
            ) : null}
        </div>
    );
}
