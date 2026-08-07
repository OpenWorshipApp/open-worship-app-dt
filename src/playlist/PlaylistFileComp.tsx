import { useCallback, useMemo, useState } from 'react';

import type { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';
import {
    createMouseEvent,
    showAppContextMenu,
} from '../context-menu/appContextMenuHelpers';
import { genContextMenuItemIcon } from '../context-menu/contextMenuIconHelpers';
import type { AppDocumentSourceAbs } from '../helper/AppEditableDocumentSourceAbs';
import { useAppEffect, useAppCurrentRef } from '../helper/appHooks';
import FileSource from '../helper/FileSource';
import { useStateSettingBoolean } from '../helper/settingHelpers';
import { tran } from '../lang/langHelpers';
import FileItemHandlerComp from '../others/FileItemHandlerComp';
import FileReadErrorComp from '../others/FileReadErrorComp';
import LoadingComp from '../others/LoadingComp';
import Playlist from './Playlist';
import type {
    PlaylistActionArmingType,
    PlaylistActionType,
} from './playlistActionHelpers';
import {
    checkIsPlaylistActionGroup,
    playlistActionMenuList,
} from './playlistActionHelpers';
import {
    askForPlaylistActionArming,
    askForPlaylistActionScreenIds,
} from './playlistActionArmingHelpers';
import { exportPlaylist } from './playlistArchiveHelpers';
import { usePlaylistItems } from './playlistItemsHelpers';
import { checkIsPlaylistFilePathOnScreen } from './playlistOnScreenHelpers';
import PlaylistItemComp from './PlaylistItemComp';
import {
    extractDropPayload,
    playlistDraggingStore,
    toPlaylistSettingName,
    UNSUPPORTED_DROP_PAYLOAD,
} from './playlistHelpers';
import { showSimpleToast } from '../toast/toastHelpers';
import {
    setPlaylistPreviewFilePath,
    togglePlaylistPreviewFilePath,
    usePlaylistPreviewFilePath,
} from './playlistPreviewFloatingHelpers';

function PlaylistItemsComp({
    playlist,
}: Readonly<{
    playlist: Playlist;
}>) {
    const playlistItems = usePlaylistItems(playlist.filePath);
    if (playlistItems === undefined) {
        return (
            <div
                style={{ minHeight: '1.5rem' }}
                className="d-flex align-items-center justify-content-center"
            >
                <LoadingComp />
            </div>
        );
    }
    if (playlistItems === null) {
        return <FileReadErrorComp />;
    }
    if (playlistItems.length === 0) {
        return (
            <div className="app-playlist-row app-playlist-row-empty">
                {tran('Drop items here')}
            </div>
        );
    }
    return (
        <>
            {playlistItems.map((playlistItem, i) => {
                return (
                    <PlaylistItemComp
                        key={`${playlistItem.type}-${i}`}
                        playlist={playlist}
                        playlistItem={playlistItem}
                        index={i}
                        itemCount={playlistItems.length}
                    />
                );
            })}
        </>
    );
}

function PlaylistPreviewComp({
    isOpened,
    setIsOpened,
    playlist,
}: Readonly<{
    isOpened: boolean;
    setIsOpened: (isOpened: boolean) => void;
    playlist: Playlist;
}>) {
    const fileSource = FileSource.getInstance(playlist.filePath);
    const previewingFilePath = usePlaylistPreviewFilePath();
    const isOpenedRef = useAppCurrentRef(isOpened);
    const setIsOpenedRef = useAppCurrentRef(setIsOpened);
    const handleToggleOpened = useCallback(() => {
        setIsOpenedRef.current(!isOpenedRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const playlistRef = useAppCurrentRef(playlist);
    const handlePreviewToggling = useCallback((event: any) => {
        event.stopPropagation();
        togglePlaylistPreviewFilePath(playlistRef.current.filePath);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        <div className="w-100 app-playlist">
            <div
                className="app-playlist-header d-flex align-items-center"
                onClick={handleToggleOpened}
            >
                <i className={`bi bi-chevron-${isOpened ? 'down' : 'right'}`} />
                <span className="app-ellipsis flex-fill ps-1">
                    {fileSource.name}
                </span>
                <i
                    className={
                        'bi bi-window-stack app-caught-hover-pointer px-1' +
                        (previewingFilePath === playlist.filePath
                            ? ' app-playlist-preview-showing'
                            : '')
                    }
                    title={tran('Preview Playlist')}
                    onClick={handlePreviewToggling}
                />
            </div>
            {isOpened ? <PlaylistItemsComp playlist={playlist} /> : null}
        </div>
    );
}

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
    const settingName = toPlaylistSettingName('playlist-opened', filePath);
    const [isOpened, setIsOpened] = useStateSettingBoolean(settingName);
    // Deliberately NOT re-created on file update. The instance holds no content
    // — `getItems()` re-reads the file every time — and dropping it back to
    // `undefined` on every add/remove flashed the row back to a spinner (and
    // raced the next drop, which bails out while there is no playlist yet).
    // `PlaylistItemsComp` listens for the same event and re-reads the items.
    const handleReloading = useCallback(() => {
        playlistRef.current?.fileSource.fireUpdateEvent();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const setIsOpenedRef = useAppCurrentRef(setIsOpened);
    const contextMenuItems = useMemo((): ContextMenuItemType[] => {
        const genActionMenuItem = (
            action: PlaylistActionType,
        ): ContextMenuItemType => {
            return {
                childBefore: genContextMenuItemIcon(action.iconName, {
                    color: action.color,
                }),
                menuElement: tran(action.label),
                onSelect: async () => {
                    // A run action armed with a NUMBER — or with a time of day,
                    // or with a SHORTCUT — is asked for it BEFORE the entry
                    // exists: a clock without one is not a valid entry
                    // (`PlaylistItem.validate`) and a shortcut must be free
                    // before the line is written, so a cancelled question must
                    // add nothing. One armed with something else — a `Jump to`
                    // takes the CC attached to it afterwards — asks nothing and
                    // is added straight away.
                    let arming: PlaylistActionArmingType | undefined;
                    let screenIds: number[] | undefined;
                    if (
                        action.target === 'run' &&
                        (action.number !== null || action.canBeKeyArmed)
                    ) {
                        const answer = await askForPlaylistActionArming(action);
                        if (answer === null) {
                            return;
                        }
                        arming = answer;
                    } else if (
                        action.target === 'screen' &&
                        action.requiresScreenIds
                    ) {
                        // The screen family's half of the same question: a
                        // `Screen: Show` that named no screen would fall back to
                        // whatever is selected, which is the one thing it may
                        // never do. Asked here, so a cancelled answer adds
                        // nothing.
                        const answer =
                            await askForPlaylistActionScreenIds(action);
                        if (answer === null) {
                            return;
                        }
                        screenIds = answer;
                    }
                    const isAdded = await Playlist.getInstance(
                        filePath,
                    ).addActionItem(action.id, arming, undefined, screenIds);
                    if (isAdded) {
                        setIsOpenedRef.current(true);
                    }
                },
            };
        };
        return [
            {
                childBefore: genContextMenuItemIcon('window-stack'),
                menuElement: tran('Open Preview'),
                onSelect: () => {
                    setPlaylistPreviewFilePath(filePath);
                },
            },
            {
                // A generic icon on purpose: clearing is only the first family
                // of actions this menu offers.
                childBefore: genContextMenuItemIcon('lightning-charge'),
                menuElement: tran('Add Action'),
                // A second menu opened from this one's event, the way colour
                // notes are chosen — the action list is short and fixed, so the
                // pair reads as one nested menu.
                onSelect: (event) => {
                    event.stopPropagation();
                    showAppContextMenu(
                        event as MouseEvent,
                        playlistActionMenuList.map((entry) => {
                            if (!checkIsPlaylistActionGroup(entry)) {
                                return genActionMenuItem(entry);
                            }
                            // A FAMILY, not an action: it adds nothing and opens
                            // a menu of its own. A chevron says so before it is
                            // clicked — every other row here writes a line into
                            // the run sheet.
                            return {
                                childBefore: genContextMenuItemIcon(
                                    entry.iconName,
                                    { color: entry.color },
                                ),
                                childAfter:
                                    genContextMenuItemIcon('chevron-right'),
                                menuElement: tran(entry.label),
                                onSelect: (subEvent: any) => {
                                    subEvent.stopPropagation();
                                    // The host closes this menu around
                                    // `onSelect`, so the event is spent by the
                                    // time the third level opens — its
                                    // coordinates are kept and a fresh event
                                    // synthesized at them, exactly as the
                                    // screen-pin checklist reopens itself.
                                    const { clientX, clientY } = subEvent;
                                    showAppContextMenu(
                                        createMouseEvent(clientX, clientY),
                                        entry.actionList.map(genActionMenuItem),
                                    );
                                },
                            };
                        }),
                    );
                },
            },
            {
                childBefore: genContextMenuItemIcon('file-earmark-arrow-down'),
                menuElement: tran('Export'),
                onSelect: () => {
                    exportPlaylist(Playlist.getInstance(filePath));
                },
            },
        ];
    }, [filePath, setIsOpenedRef]);
    const handleDropping = useCallback(async (event: any) => {
        // An item dragged out of a playlist row is being reordered inside its
        // own list; that is handled by the row it lands on, not here.
        if (playlistRef.current === null || playlistRef.current === undefined) {
            return;
        }
        if (playlistDraggingStore.current !== null) {
            return;
        }
        const payload = extractDropPayload(event);
        if (payload === null) {
            return;
        }
        if (payload === UNSUPPORTED_DROP_PAYLOAD) {
            showSimpleToast(
                tran('Adding Playlist Item'),
                tran('This item type cannot be added to a playlist'),
            );
            return;
        }
        const isAdded = await playlistRef.current.addItem(
            payload.droppedData,
            payload.dragData,
        );
        if (isAdded) {
            setIsOpenedRef.current(true);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleChildRendering = useCallback(
        (playlist: AppDocumentSourceAbs) => {
            return (
                <PlaylistPreviewComp
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
        setPlaylist(Playlist.getInstance(filePath));
    }, [playlist, filePath]);
    return (
        <FileItemHandlerComp
            index={index}
            fileData={playlist}
            reload={handleReloading}
            filePath={filePath}
            className="playlist-file"
            contextMenuItems={contextMenuItems}
            onDrop={handleDropping}
            renderChild={handleChildRendering}
            isSelected={isOpened}
            checkIsOnScreen={checkIsPlaylistFilePathOnScreen}
        />
    );
}
