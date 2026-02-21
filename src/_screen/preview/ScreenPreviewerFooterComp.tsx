import { lazy, useState } from 'react';

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
    return (
        <button
            className={`btn btn-sm btn-${isAudioHandlersVisible ? 'primary' : 'outline-secondary'}`}
            onClick={() => {
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
                setIsAudioHandlersVisible(!isAudioHandlersVisible);
            }}
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
    const setStageNumber1 = (newStageNumber: number) => {
        screenManagerBase.stageNumber = newStageNumber;
        setStageNumber(newStageNumber);
    };
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
                <div className="flex-grow-1 d-flex justify-content-end">
                    <div
                        className="d-flex app-caught-hover-pointer"
                        title={tran('Click to change Stage Number')}
                        onClick={(event) => {
                            getNewStageNumber(
                                event,
                                stageNumber,
                                setStageNumber1,
                            );
                        }}
                    >
                        <small>{tran('Stage:')}</small>
                        <div className="px-1 text-muted">{stageNumber}</div>
                    </div>
                </div>
            </div>
            {videoSources.length > 0 && isAudioHandlersVisible ? (
                <AppSuspenseComp>
                    <div className="w-100">
                        {videoSources.map(([videoSource, videoID]) => (
                            <LazyMiniScreenAudioHandlersComp
                                key={videoSource}
                                src={videoSource}
                                videoID={videoID}
                            />
                        ))}
                    </div>
                </AppSuspenseComp>
            ) : null}
        </div>
    );
}
