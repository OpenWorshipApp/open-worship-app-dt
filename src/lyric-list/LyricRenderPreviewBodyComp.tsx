import { useLyricManagerContext } from './LyricManager';

export default function LyricRenderPreviewBodyComp() {
    const lyricManager = useLyricManagerContext();

    return (
        <div
            className="w-100 h-100 p-0 m-0"
            style={{
                overflowX: 'hidden',
                overflowY: 'auto',
            }}
        >
            <div
                className="w-100 p-2"
                ref={(el) => {
                    const openLyric = lyricManager.openLyricPreviewer;
                    if (el === null || openLyric.container === el) {
                        return;
                    }
                    openLyric.container = el;
                    openLyric.mount();
                    return () => {
                        openLyric.container = null;
                    };
                }}
                style={{
                    height: 'fit-content',
                }}
            ></div>
        </div>
    );
}
