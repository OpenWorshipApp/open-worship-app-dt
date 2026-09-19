import { tran } from '../lang/langHelpers';

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
    const label = isFulledScreen ? tran('Exit Full') : tran('Full');
    return (
        <button
            className={
                'btn btn-info btn-sm text-nowrap d-flex align-items-center gap-1'
            }
            title={label}
            onClick={async () => {
                toggleFullScreen(!isFulledScreen);
            }}
        >
            <i className={`bi bi-${fullScreenClassname}`} />
            <span>{label}</span>
        </button>
    );
}
