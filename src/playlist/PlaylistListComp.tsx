import './PlaylistListComp.scss';

import { useCallback } from 'react';

import PlaylistFileComp from './PlaylistFileComp';
import FileListHandlerComp from '../others/FileListHandlerComp';
import Playlist from './Playlist';
import { useGenDirSourceReload } from '../helper/dirSourceHelpers';
import {
    defaultDataDirNames,
    dirSourceSettingNames,
} from '../helper/constants';
import { toIconedLabel } from '../others/labelIconHelpers';
import type { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';
import { genContextMenuItemIcon } from '../context-menu/contextMenuIconHelpers';
import { tran } from '../lang/langHelpers';
import type { DroppedFileType } from '../others/droppingFileHelpers';
import { getFileFullName } from '../server/fileHelpers';
import {
    askAndImportPlaylistArchiveFromUrl,
    checkIsPlaylistArchiveFileFullName,
    importDroppedPlaylistArchive,
    selectAndImportPlaylistArchive,
} from './playlistArchiveHelpers';
import { checkIsAnyPlaylistOnScreen } from './playlistOnScreenHelpers';
import PlaylistPreviewFloatingComp from './PlaylistPreviewFloatingComp';

// Built per call rather than at module scope: `tran` reads the loaded language,
// which is not ready when this module is first imported.
function genContextMenuItems(): ContextMenuItemType[] {
    return [
        {
            childBefore: genContextMenuItemIcon('box-arrow-in-down'),
            menuElement: tran('Import'),
            onSelect: () => {
                selectAndImportPlaylistArchive();
            },
        },
        {
            childBefore: genContextMenuItemIcon('cloud-download'),
            menuElement: tran('Import From URL'),
            onSelect: () => {
                askAndImportPlaylistArchiveFromUrl();
            },
        },
    ];
}

/**
 * An exported bundle dropped onto the list is imported rather than dropped into
 * the playlists folder as-is: the archive itself is not a playlist the app can
 * open, so copying it there would only leave an unreadable file behind. Any
 * other file falls through to the default handling.
 */
function handleDroppedFileTaking(file: DroppedFileType) {
    const fileFullName = getFileFullName(file);
    if (
        fileFullName === undefined ||
        !checkIsPlaylistArchiveFileFullName(fileFullName)
    ) {
        return false;
    }
    importDroppedPlaylistArchive(file);
    return true;
}

export default function PlaylistListComp() {
    const dirSource = useGenDirSourceReload(dirSourceSettingNames.PLAYLIST);
    const handleBodyRendering = useCallback((filePaths: string[]) => {
        return (
            <>
                {filePaths.map((filePath, i) => {
                    return (
                        <PlaylistFileComp
                            key={filePath}
                            index={i}
                            filePath={filePath}
                        />
                    );
                })}
            </>
        );
    }, []);
    if (dirSource === null) {
        return null;
    }
    return (
        <>
            <FileListHandlerComp
                className="playlist-list"
                mimetypeName="playlist"
                defaultFolderName={defaultDataDirNames.PLAYLIST}
                dirSource={dirSource}
                takeDroppedFile={handleDroppedFileTaking}
                onNewFile={async (dirPath: string, name: string) => {
                    return !(await Playlist.create(dirPath, name));
                }}
                header={<span>{toIconedLabel('Playlists')}</span>}
                bodyHandler={handleBodyRendering}
                genContextMenuItems={genContextMenuItems}
                checkIsOnScreen={checkIsAnyPlaylistOnScreen}
            />
            <PlaylistPreviewFloatingComp />
        </>
    );
}
