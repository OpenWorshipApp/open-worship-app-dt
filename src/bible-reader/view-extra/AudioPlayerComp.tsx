import { type SyntheticEvent, useCallback } from 'react';

import { tran } from '../../lang/langHelpers';
import LoadingComp from '../../others/LoadingComp';
import { getAISetting } from '../../helper/ai/aiHelpers';
import { playMediaElement } from '../../helper/mediaHelpers';
import appProvider from '../../server/appProvider';
import { showAppContextMenu } from '../../context-menu/appContextMenuHelpers';
import { useAppCurrentRef } from '../../helper/appHooks';

export default function AudioPlayerComp({
    src,
    onStart,
    onEnd,
    refreshAudio,
}: Readonly<{
    src: string | undefined | null;
    onStart: (audio: HTMLAudioElement) => void;
    onEnd: (audio: HTMLAudioElement) => void;
    refreshAudio: () => void;
}>) {
    const refreshAudioRef = useAppCurrentRef(refreshAudio);
    const handleContextMenuOpening = useCallback((event: any) => {
        showAppContextMenu(event, [
            {
                menuElement: tran('Refresh'),
                onSelect: refreshAudioRef.current,
            },
        ]);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handlePlay = useCallback(
        (event: SyntheticEvent<HTMLAudioElement>) => {
            const el = event.currentTarget;
            for (const el1 of document.querySelectorAll('audio')) {
                if (el1 !== el) {
                    el1.pause();
                }
            }
        },
        [],
    );
    const onEndRef = useAppCurrentRef(onEnd);
    const handleEnded = useCallback(
        (event: SyntheticEvent<HTMLAudioElement>) => {
            const el = event.currentTarget;
            if (el && el.checkVisibility()) {
                onEndRef.current(el);
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    if (src === undefined) {
        return (
            <div
                className="verse-audio"
                style={{
                    width: '40px',
                    height: '40px',
                }}
            >
                <LoadingComp />
            </div>
        );
    }
    if (src === null) {
        return null;
    }
    return (
        <audio
            className="verse-audio"
            ref={(element) => {
                const openAISetting = getAISetting();
                if (
                    appProvider.isPageReader &&
                    openAISetting.isAutoPlay &&
                    element?.checkVisibility()
                ) {
                    playMediaElement(element);
                    element.focus();
                    onStart(element);
                }
            }}
            controls
            onPlay={handlePlay}
            onEnded={handleEnded}
            onContextMenu={handleContextMenuOpening}
        >
            <source src={src} />
            <track kind="captions" />
            Browser does not support audio.
        </audio>
    );
}
