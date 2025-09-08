export default function FullScreenButtonComp({
    isFulledScreen,
    toggleFullScreen,
}: Readonly<{
    isFulledScreen: boolean;
    toggleFullScreen: (isFullScreen: boolean) => void;
}>) {
    const fullScreenClassname = isFulledScreen
        ? 'fullscreen-exit'
        : 'arrows-fullscreen';
    return (
        <div style={{ overflow: 'hidden' }}>
            <button
                className="btn btn-info btn-sm"
                onClick={async () => {
                    toggleFullScreen(!isFulledScreen);
                }}
            >
                <i className={`bi bi-${fullScreenClassname}`} />
                {isFulledScreen ? '`Exit ' : '`'}Full
            </button>
        </div>
    );
}
