import { useState } from 'react';

import { useAppStateAsync } from '../helper/appHooks';
import { useFileSourceEvents } from '../helper/dirSourceHelpers';
import Playlist from './Playlist';

/**
 * Read a playlist's items and re-read them whenever the file changes.
 *
 * Lives in its own module rather than in `playlistHelpers`: that one is
 * imported by `PlaylistItem`, so pulling `Playlist` into it would close a
 * runtime cycle (`playlistHelpers` → `Playlist` → `PlaylistItem` →
 * `playlistHelpers`) of exactly the shape that has already bitten this codebase
 * once with `class extends undefined`.
 */
export function usePlaylistItems(filePath: string) {
    const [reloadCount, setReloadCount] = useState(0);
    const [playlistItems] = useAppStateAsync(() => {
        return Playlist.getInstance(filePath).getItems();
    }, [filePath, reloadCount]);
    useFileSourceEvents(
        ['update'],
        () => {
            setReloadCount((prev) => {
                return prev + 1;
            });
        },
        [],
        filePath,
    );
    return playlistItems;
}
