import { useCallback, useState } from 'react';

import { useStateSettingBoolean } from '../helper/settingHelpers';
import type BibleItem from '../bible-list/BibleItem';
import PlaylistSlideItemComp from './PlaylistSlideItemComp';
import FileItemHandlerComp from '../others/FileItemHandlerComp';
import Playlist from './Playlist';
import BibleItemRenderComp from '../bible-list/BibleItemRenderComp';
import type PlaylistItem from './PlaylistItem';
import type { AppDocumentSourceAbs } from '../helper/AppEditableDocumentSourceAbs';
import {
    useAppEffect,
    useAppEffectAsync,
    useAppStateAsync,
    useAppCurrentRef,
} from '../helper/appHooks';
import FileSource from '../helper/FileSource';
import { useFileSourceEvents } from '../helper/dirSourceHelpers';
import AppSuspenseComp from '../others/AppSuspenseComp';
import { tran } from '../lang/langHelpers';
import LoadingComp from '../others/LoadingComp';
import FileReadErrorComp from '../others/FileReadErrorComp';

export default function PlaylistFileComp({
    index,
    filePath,
}: Readonly<{
    index: number;
    filePath: string;
}>) {
    const [playlist, setPlaylist] = useState<Playlist | null | undefined>(
        undefined,
    );
    const playlistRef = useAppCurrentRef(playlist);
    const settingName = `opened-${filePath}`;
    const [isOpened, setIsOpened] = useStateSettingBoolean(settingName);
    useFileSourceEvents(
        ['update'],
        () => {
            setPlaylist(undefined);
        },
        [],
        filePath,
    );
    const handleReloading = useCallback(() => {
        playlistRef.current?.fileSource.fireUpdateEvent();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const isOpenedRef = useAppCurrentRef(isOpened);
    const setIsOpenedRef = useAppCurrentRef(setIsOpened);
    const handleClicking = useCallback(() => {
        setIsOpenedRef.current(!isOpenedRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleDropping = useCallback(async (event: any) => {
        if (playlistRef.current) {
            const receivedData = event.dataTransfer.getData('text');
            await playlistRef.current.addFromData(receivedData);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleChildRendering = useCallback(
        (playlist: AppDocumentSourceAbs) => {
            return (
                <PlaylistPreview
                    isOpened={isOpened}
                    setIsOpened={setIsOpened}
                    playlist={playlist as Playlist}
                />
            );
        },
        [isOpened, setIsOpened],
    );
    useAppEffect(() => {
        if (playlist !== undefined) {
            return;
        }
        const newPlaylist = Playlist.getInstance(filePath);
        setPlaylist(newPlaylist);
    }, [playlist, filePath]);
    return (
        <FileItemHandlerComp
            index={index}
            fileData={playlist}
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
    const [items] = useAppStateAsync(() => {
        return playlist.getItems();
    }, [playlist]);
    const isOpenedRef = useAppCurrentRef(isOpened);
    const setIsOpenedRef = useAppCurrentRef(setIsOpened);
    const handleToggleOpened = useCallback(() => {
        setIsOpenedRef.current(!isOpenedRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    if (items === undefined) {
        return <LoadingComp />;
    }
    if (items === null) {
        return <FileReadErrorComp />;
    }
    return (
        <div className="card app-caught-hover-pointer mt-1 ps-2">
            <div className="card-header" onClick={handleToggleOpened}>
                <i
                    className={`bi ${
                        isOpened ? 'bi-chevron-down' : 'bi-chevron-right'
                    }`}
                />
                {fileSource.name}
            </div>
            {isOpened && playlist && (
                <div className="card-body d-flex flex-column">
                    {items.map((playlistItem, i) => {
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
        return <div>{tran('Not Supported Item Type')}</div>;
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
    useAppEffectAsync(
        async (contextMethods) => {
            const newBibleItem = await playlistItem.getBibleItem();
            contextMethods.setBibleItem(newBibleItem);
        },
        [playlistItem],
        { setBibleItem },
    );
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
