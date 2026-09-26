import { useCallback } from 'react';

import MediaSessionsComp, {
    toSessionSuffix,
    useMediaSessionAutoPlayRefresh,
    useMediaSessions,
} from '../media-sessions/MediaSessionsComp';
import { useAppCurrentRef } from '../helper/appHooks';
import {
    toFilterTypeSettingName,
    toSortSettingName,
} from '../others/fileListFilterHelpers';
import {
    applyAutoPlayRunners,
    getRunningAutoPlayKeys,
} from '../slide-auto-play/autoPlayRunnerHelpers';
import { genSlideAutoPlaySettingNames } from '../slide-auto-play/slideAutoPlayHelpers';
import { toBackgroundViewModeSettingName } from './BackgroundViewModeComp';

/**
 * A Background tab's **folder sessions** -- the strip the foreground media
 * widgets carry, one layer down.
 *
 * A church keeps its pictures and clips in more than one place: this Sunday's
 * slides in a folder somebody just copied off a stick, the standing set of
 * backgrounds in the data folder, the sermon's illustrations somewhere else
 * again. Before this, reaching any of them meant re-pointing the tab's ONE
 * folder -- and that folder is the one Path Settings names, so the way back
 * was to remember what it used to be.
 *
 * What a session owns is everything keyed by the folder's setting name: the
 * folder, the grid's view mode, its sort and filter, and its slide show. The
 * Default session's id is the empty string, so it keeps writing the very keys
 * the tab has always used -- nothing an existing install has set moves, and
 * Path Settings still points at Default.
 */
export type BackgroundSessionsPropsType = {
    /** The settings namespace, e.g. `background-image`. */
    target: string;
    /** The tab's own folder setting, with no session suffix. */
    dirSourceSettingName: string;
    /**
     * The tab's own slide-show prefix, with no session suffix. Left out by a
     * list that runs no show at all -- the Audios tab plays a track, it does
     * not advance one.
     */
    autoPlayPrefix?: string;
    /**
     * Answers false to REFUSE a change of session, having said why. Switching
     * remounts the list, so the Audios tab refuses while one of its own rows
     * is playing -- unmounting a playing `<audio>` stops the sound, which is
     * the same reason its tab cannot be closed mid-track.
     */
    checkCanChangeSession?: () => boolean;
};

function genSessionSettingNames(
    props: BackgroundSessionsPropsType,
    sessionId: string,
) {
    const suffix = toSessionSuffix(sessionId);
    const dirSourceSettingName = `${props.dirSourceSettingName}${suffix}`;
    return [
        dirSourceSettingName,
        toBackgroundViewModeSettingName(dirSourceSettingName),
        toSortSettingName(dirSourceSettingName),
        toFilterTypeSettingName(dirSourceSettingName),
        ...(props.autoPlayPrefix === undefined
            ? []
            : genSlideAutoPlaySettingNames(`${props.autoPlayPrefix}${suffix}`)),
    ];
}

function toAutoPlayPrefix(
    props: BackgroundSessionsPropsType,
    sessionId: string,
) {
    if (props.autoPlayPrefix === undefined) {
        return null;
    }
    return `${props.autoPlayPrefix}${toSessionSuffix(sessionId)}`;
}

export function useBackgroundSessions(props: BackgroundSessionsPropsType) {
    const {
        sessions,
        activeId,
        setActiveId,
        addSession,
        renameSession,
        removeSession,
    } = useMediaSessions(props.target);
    // The ▶ on a chip is the only sign of a show running in a session the
    // operator is not looking at, so it has to follow the show rather than
    // whatever next redraws the tab.
    useMediaSessionAutoPlayRefresh();
    // Read once for the whole strip: a tab has a handful of sessions.
    const runningAutoPlayKeys = getRunningAutoPlayKeys();
    const propsRef = useAppCurrentRef(props);
    const removeSessionRef = useAppCurrentRef(removeSession);
    const setActiveIdRef = useAppCurrentRef(setActiveId);
    const addSessionRef = useAppCurrentRef(addSession);
    // One gate in front of every route that swaps the list out, rather than
    // one per button: a new session is switched TO, and a removed one hands
    // the panel to whatever is left.
    const checkCanChange = () => {
        return propsRef.current.checkCanChangeSession?.() ?? true;
    };
    const checkCanChangeRef = useAppCurrentRef(checkCanChange);
    const handleSessionChoosing = useCallback((sessionId: string) => {
        if (!checkCanChangeRef.current()) {
            return;
        }
        setActiveIdRef.current(sessionId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleSessionAdding = useCallback(() => {
        if (!checkCanChangeRef.current()) {
            return;
        }
        addSessionRef.current();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleSessionRemoving = useCallback((sessionId: string) => {
        if (!checkCanChangeRef.current()) {
            return;
        }
        // Its show is a timer in a module, not in this tree, and its settings
        // are about to be forgotten -- so nothing would ever stop it again.
        const showKey = toAutoPlayPrefix(propsRef.current, sessionId);
        if (showKey !== null) {
            applyAutoPlayRunners([], (key) => {
                return key === showKey;
            });
        }
        removeSessionRef.current(sessionId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const suffix = toSessionSuffix(activeId);
    return {
        activeId,
        suffix,
        dirSourceSettingName: `${props.dirSourceSettingName}${suffix}`,
        autoPlayPrefix: toAutoPlayPrefix(props, activeId) ?? undefined,
        element: (
            <MediaSessionsComp
                target={props.target}
                sessions={sessions}
                activeId={activeId}
                onChoose={handleSessionChoosing}
                onAdd={handleSessionAdding}
                onRename={renameSession}
                onRemove={handleSessionRemoving}
                genRemovedSettingNames={genSessionSettingNames.bind(
                    null,
                    props,
                )}
                genSessionState={(sessionId) => {
                    return {
                        // Deliberately not answered per session. There is ONE
                        // background layer, the tab's own title already marks
                        // it with a `*`, and telling WHICH session's folder
                        // the picture on the wall came from would mean reading
                        // every session's folder off disk on every redraw of a
                        // grid that redraws a lot.
                        isOnScreen: false,
                        isAutoPlaying: runningAutoPlayKeys.includes(
                            toAutoPlayPrefix(props, sessionId) ?? '',
                        ),
                    };
                }}
            />
        ),
    };
}
