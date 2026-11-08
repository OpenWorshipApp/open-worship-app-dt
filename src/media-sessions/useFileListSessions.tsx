import { useCallback } from 'react';

import MediaSessionsComp, { useMediaSessions } from './MediaSessionsComp';
import { DEFAULT_SESSION_ID } from './mediaSessionData';
import { toSessionDirSourceSettingName } from './folderSessionHelpers';
import {
    toFilterTypeSettingName,
    toSortSettingName,
} from '../others/fileListFilterHelpers';
import { useAppCurrentRef } from '../helper/appHooks';
import { removeSetting } from '../helper/settingHelpers';
import { handleError } from '../helper/errorHelpers';
import { appLocalStorage } from '../setting/directory-setting/appLocalStorage';

/**
 * A file list's **folder sessions** -- Documents, Presenting Flows, Bibles
 * and Bible Notes -- the strip the Background tabs carry, drawn under the
 * list's own title.
 *
 * A church keeps this Sunday's songs in a folder somebody just copied off a
 * stick, the standing songbook in the data folder, and last Easter's set
 * somewhere else again. Before this, reaching any of them meant re-pointing
 * the list's ONE folder -- the one Path Settings names -- and remembering
 * what it used to be.
 *
 * What a session owns is everything keyed by its folder setting: the folder,
 * the list's sort and filter, and which colour groups are folded. The target
 * is the base folder setting itself (see `folderSessionHelpers`), and Default
 * keeps the base keys, so nothing an existing install set moves.
 */
function genSessionSettingNames(baseSettingName: string, sessionId: string) {
    const dirSourceSettingName = toSessionDirSourceSettingName(
        baseSettingName,
        sessionId,
    );
    return [
        dirSourceSettingName,
        toSortSettingName(dirSourceSettingName),
        toFilterTypeSettingName(dirSourceSettingName),
    ];
}

/**
 * The keys a removed session wrote that cannot be named up front: one folded
 * flag per colour group (`RenderListComp`), and a colour can be any the user
 * picked. One listing of the settings folder, on an explicit removal only --
 * never on a read path. The id's own trailing hyphen keeps `s1` from sweeping
 * `s12`.
 */
async function forgetSessionLeftoverSettings(
    baseSettingName: string,
    sessionId: string,
) {
    if (sessionId === DEFAULT_SESSION_ID) {
        return;
    }
    const prefix = `${toSessionDirSourceSettingName(baseSettingName, sessionId)}-`;
    const keys = await appLocalStorage.listKeys();
    for (const key of keys) {
        if (key.startsWith(prefix)) {
            removeSetting(key);
        }
    }
}

/**
 * Only the ACTIVE session's folder is watched (`dirWatchingHelpers`), so a
 * switch hands the watch over. Imported on demand: `dirWatchingHelpers` is
 * not something a list has to load to draw.
 */
function resyncFolderWatches() {
    import('../helper/dirWatchingHelpers')
        .then(({ resyncDataDirWatches }) => {
            return resyncDataDirWatches();
        })
        .catch(handleError);
}

const SESSION_STATE = { isOnScreen: false, isAutoPlaying: false };
function genSessionState() {
    // Deliberately not answered per session: telling whether a slide on the
    // screen came from a session's folder would mean reading every session's
    // folder off disk on every redraw. The list's own title already marks
    // the folder in front.
    return SESSION_STATE;
}

export function useFileListSessions(baseSettingName: string) {
    const {
        sessions,
        activeId,
        setActiveId,
        addSession,
        renameSession,
        removeSession,
    } = useMediaSessions(baseSettingName);
    const baseSettingNameRef = useAppCurrentRef(baseSettingName);
    const setActiveIdRef = useAppCurrentRef(setActiveId);
    const addSessionRef = useAppCurrentRef(addSession);
    const removeSessionRef = useAppCurrentRef(removeSession);
    const handleSessionChoosing = useCallback((sessionId: string) => {
        setActiveIdRef.current(sessionId);
        resyncFolderWatches();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleSessionAdding = useCallback(() => {
        addSessionRef.current();
        resyncFolderWatches();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleSessionRemoving = useCallback((sessionId: string) => {
        removeSessionRef.current(sessionId);
        resyncFolderWatches();
        forgetSessionLeftoverSettings(
            baseSettingNameRef.current,
            sessionId,
        ).catch(handleError);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleRemovedSettingNamesGenerating = useCallback(
        (sessionId: string) => {
            return genSessionSettingNames(
                baseSettingNameRef.current,
                sessionId,
            );
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    return {
        activeId,
        isDefaultSession: activeId === DEFAULT_SESSION_ID,
        dirSourceSettingName: toSessionDirSourceSettingName(
            baseSettingName,
            activeId,
        ),
        element: (
            <MediaSessionsComp
                target={baseSettingName}
                sessions={sessions}
                activeId={activeId}
                onChoose={handleSessionChoosing}
                onAdd={handleSessionAdding}
                onRename={renameSession}
                onRemove={handleSessionRemoving}
                genRemovedSettingNames={handleRemovedSettingNamesGenerating}
                genSessionState={genSessionState}
            />
        ),
    };
}
