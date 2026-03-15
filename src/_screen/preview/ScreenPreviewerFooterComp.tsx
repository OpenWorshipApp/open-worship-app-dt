import { lazy, useCallback, useState } from 'react';

import { tran } from '../../lang/langHelpers';
import {
    useScreenManagerBaseContext,
    useScreenVideoSources,
} from '../managers/screenManagerHooks';
import DisplayControl from './DisplayControl';
import ScreenEffectControlComp from './ScreenEffectControlComp';
import type { ContextMenuItemType } from '../../context-menu/appContextMenuHelpers';
import { showAppContextMenu } from '../../context-menu/appContextMenuHelpers';
import AppSuspenseComp from '../../others/AppSuspenseComp';
import { showSimpleToast } from '../../toast/toastHelpers';

const LazyMiniScreenAudioHandlersComp = lazy(() => {
    return import('./MiniScreenAudioHandlersComp');
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
    const handleToggleAudioHandlers = useCallback(() => {
        if (isAudioHandlersVisible) {
            const isPlaying = Array.from(
                document.querySelectorAll<HTMLAudioElement>(
                    'audio[data-video-id]',
                ),
            );
            if (isPlaying.some((audio) => !audio.paused)) {
                showSimpleToast(
                    tran('Audio is Playing'),
                    tran(
                        'Please pause all background audios before disabling audio handlers',
                    ),
                );
                return;
            }
        }
        setIsAudioHandlersVisible(!isAudioHandlersVisible);
    }, [isAudioHandlersVisible, setIsAudioHandlersVisible]);
    return (
        <button
            className={`btn btn-sm btn-${isAudioHandlersVisible ? 'primary' : 'outline-secondary'}`}
            onClick={handleToggleAudioHandlers}
            title={tran('Enable Background Audio Handlers')}
        >
            <i className="bi bi-soundwave" />
        </button>
    );
}

export default function ScreenPreviewerFooterComp() {
    const [isAudioHandlersVisible, setIsAudioHandlersVisible] = useState(false);
    const videoSources = useScreenVideoSources();
    const screenManagerBase = useScreenManagerBaseContext();
    const [stageNumber, setStageNumber] = useState(
        screenManagerBase.stageNumber,
    );
    const setStageNumber1 = useCallback(
        (newStageNumber: number) => {
            screenManagerBase.stageNumber = newStageNumber;
            setStageNumber(newStageNumber);
        },
        [screenManagerBase],
    );
    const handleStageNumberChange = useCallback(
        (event: any) => {
            getNewStageNumber(event, stageNumber, setStageNumber1);
        },
        [stageNumber, setStageNumber1],
    );
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
                    <DisplayControl />
                    <ScreenEffectControlComp />
                    {videoSources.length > 0 ? (
                        <BackgroundAudioSwitchComp
                            isAudioHandlersVisible={isAudioHandlersVisible}
                            setIsAudioHandlersVisible={
                                setIsAudioHandlersVisible
                            }
                        />
                    ) : null}
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
        </div>
    );
}
