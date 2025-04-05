import FileReadErrorComp from '../others/FileReadErrorComp';
import PlaylistItem from './PlaylistItem';
import SlideRendererHtmlComp from '../app-document-presenter/items/SlideRendererHtmlComp';
import AppDocumentListEventListener from '../event/VaryAppDocumentEventListener';

export default function PlaylistSlideItemComp({
    playlistItem: _playlistItem,
}: Readonly<{
    playlistItem: PlaylistItem;
}>) {
    const item = null;
    if (item === null) {
        return <FileReadErrorComp />;
    }
    return (
        <div
            className="card overflow-hidden"
            onClick={() => {
                AppDocumentListEventListener.selectAppDocumentItem(item);
            }}
        >
            <SlideRendererHtmlComp slide={item} />
        </div>
    );
}
