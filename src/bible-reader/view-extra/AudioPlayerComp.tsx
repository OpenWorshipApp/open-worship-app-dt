import LoadingComp from '../../others/LoadingComp';
import { getAISetting } from '../../helper/ai/aiHelpers';
import appProvider from '../../server/appProvider';
import { showAppContextMenu } from '../../context-menu/appContextMenuHelpers';

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
    const handleContextMenuOpening = (event: any) => {
        showAppContextMenu(event, [
            {
                menuElement: '`Refresh',
                onSelect: refreshAudio,
            },
        ]);
    };
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
                    element.play();
                    element.focus();
                    onStart(element);
                }
            }}
            controls
            onPlay={(event) => {
                const el = event.currentTarget;
                for (const el1 of document.querySelectorAll('audio')) {
                    if (el1 !== el) {
                        el1.pause();
                    }
                }
            }}
            onEnded={(event) => {
                const el = event.currentTarget;
                if (el && el.checkVisibility()) {
                    onEnd(el);
                }
            }}
            onContextMenu={handleContextMenuOpening}
        >
            <source src={src} />
            <track kind="captions" />
            Browser does not support audio.
        </audio>
    );
}
