import FileReadErrorComp from '../others/FileReadErrorComp';
import type PlaylistItem from './PlaylistItem';

export default function PlaylistSlideItemComp({
    playlistItem: _playlistItem,
}: Readonly<{
    playlistItem: PlaylistItem;
}>) {
    const item = null;
    if (item === null) {
        return <FileReadErrorComp />;
    }
    return null;
}
