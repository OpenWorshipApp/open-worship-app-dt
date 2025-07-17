import { useState } from 'react';

import { useStateSettingBoolean } from '../helper/settingHelpers';
import BibleItem from '../bible-list/BibleItem';
import PlaylistSlideItemComp from './PlaylistSlideItemComp';
import FileItemHandlerComp from '../others/FileItemHandlerComp';
import Playlist from './Playlist';
import BibleItemRenderComp from '../bible-list/BibleItemRenderComp';
import PlaylistItem from './PlaylistItem';
import { AppDocumentSourceAbs } from '../helper/AppEditableDocumentSourceAbs';
import { useAppEffect } from '../helper/debuggerHelpers';
import FileSource from '../helper/FileSource';
import AppSuspenseComp from '../others/AppSuspenseComp';

export default function PlaylistFileComp({
    index,
    filePath,
}: Readonly<{
    index: number;
    filePath: string;
}>) {
    const [data, setData] = useState<Playlist | null | undefined>(null);
    const settingName = `opened-${filePath}`;
    const [isOpened, setIsOpened] = useStateSettingBoolean(settingName);
    const handleReloading = () => {
        setData(null);
    };
    const handleClicking = () => {
        setIsOpened(!isOpened);
    };
    const handleDropping = async (event: any) => {
        if (data) {
            const receivedData = event.dataTransfer.getData('text');
            if (data.addFromData(receivedData)) {
                // data.save();
            }
        }
    };
    const handleChildRendering = (playlist: AppDocumentSourceAbs) => {
        return (
            <PlaylistPreview
                isOpened={isOpened}
                setIsOpened={setIsOpened}
                playlist={playlist as Playlist}
            />
        );
    };
    useAppEffect(() => {
        if (data === null) {
            // Playlist.readFileToData(filePath).then(setData);
        }
    }, [data]);
    return (
        <FileItemHandlerComp
            index={index}
            data={data}
            reload={handleReloading}
            filePath={filePath}
            className="playlist-file"
            onClick={handleClicking}
            onDrop={handleDropping}
            renderChild={handleChildRendering}
            isSelected={isOpened}
        />
    );
}

function PlaylistPreview({
    isOpened,
    setIsOpened,
    playlist,
}: Readonly<{
    isOpened: boolean;
    setIsOpened: (isOpened: boolean) => void;
    playlist: Playlist;
}>) {
    const fileSource = FileSource.getInstance(playlist.filePath);
    return (
        <div className="card app-caught-hover-pointer mt-1 ps-2">
            <div
                className="card-header"
                onClick={() => {
                    setIsOpened(!isOpened);
                }}
            >
                <i
                    className={`bi ${
                        isOpened ? 'bi-chevron-down' : 'bi-chevron-right'
                    }`}
                />
                {fileSource.name}
            </div>
            {isOpened && playlist && (
                <div className="card-body d-flex flex-column">
                    {playlist.items.map((playlistItem, i) => {
                        return (
                            <RenderPlaylistItem
                                key={fileSource.fullName}
                                index={i}
                                playlistItem={playlistItem}
                            />
                        );
                    })}
                </div>
            )}
        </div>
    );
}

function RenderPlaylistItem({
    playlistItem,
    index,
}: Readonly<{
    playlistItem: PlaylistItem;
    index: number;
}>) {
    if (playlistItem.isSlide) {
        return <PlaylistSlideItemComp playlistItem={playlistItem} />;
    } else if (playlistItem.isBibleItem) {
        playlistItem.getBibleItem();
        return (
            <AppSuspenseComp>
                <PlaylistBibleItem
                    key={index}
                    index={index}
                    playlistItem={playlistItem}
                />
            </AppSuspenseComp>
        );
    } else if (playlistItem.isLyric) {
        return <div>Not Supported Item Type</div>;
    }
    return null;
}

function PlaylistBibleItem({
    index,
    playlistItem,
}: Readonly<{
    index: number;
    playlistItem: PlaylistItem;
}>) {
    const [bibleItem, setBibleItem] = useState<BibleItem | null>(null);
    useAppEffect(() => {
        playlistItem.getBibleItem().then((newBibleItem) => {
            setBibleItem(newBibleItem);
        });
    }, [bibleItem]);
    if (bibleItem === null) {
        return null;
    }
    return (
        <BibleItemRenderComp
            index={index}
            bibleItem={bibleItem}
            filePath={playlistItem.filePath}
        />
    );
}
