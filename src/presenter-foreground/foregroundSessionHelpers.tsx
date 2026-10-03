import { useCallback } from 'react';

import MediaSessionsComp, {
    DEFAULT_SESSION_ID,
    toSessionSuffix,
    useMediaSessions,
} from '../media-sessions/MediaSessionsComp';
import { useAppCurrentRef } from '../helper/appHooks';
import { genPropsSettingNames } from './propertiesSettingHelpers';
import { genCommonStyleSettingNames } from './ForegroundCommonPropertiesSettingComp';
import { genDecorationSettingName } from './foregroundDecorationHelpers';

/**
 * A foreground component's **sessions** -- the strip the media widgets and the
 * Background tabs already carry, given to the text and timer components.
 *
 * A session is one saved set-up of the panel: its own words or numbers AND its
 * own Properties, so the same widget holds the pre-service notice in one and
 * the offering countdown in another, each already the right size in the right
 * corner. Before this, a panel had exactly one set-up, and the way to the
 * other one was to retype it -- minutes before a service, from memory, over
 * the one that was working.
 *
 * Everything is keyed by the session's SUFFIX, and the Default session's is
 * the empty string: an existing install keeps writing the very keys it always
 * has, so nothing anybody has already set up moves.
 */

/**
 * Every setting the shared Properties panel writes under one prefix -- the
 * geometry, the common text style, the decoration and whether the panel was
 * left open.
 *
 * One list rather than each widget's own, because a key missed here is a file
 * left behind in the data folder for a session the user removed, and nothing
 * would ever name it again.
 */
export function genForegroundPropsSettingNames(prefix: string) {
    return [
        ...Object.values(genPropsSettingNames(prefix)),
        ...Object.values(genCommonStyleSettingNames(prefix)),
        genDecorationSettingName(prefix),
        `foreground-${prefix}-show-properties-setting`,
    ];
}

export type ForegroundSessionsPropsType = {
    /**
     * The widget's key -- `countdown`, `marquee-top`. The session list lives
     * under `foreground-<key>`, never the bare key: `image` is both Image Show
     * and the Background Images tab, and the two must not share a list.
     */
    widgetKey: string;
    /**
     * The Properties prefix one session of this widget is on. Left out by a
     * widget whose Properties belong to the ITEMS a session holds rather than
     * to the session -- the clock panel files them under each clock's own id --
     * and such a widget must not read the `prefix` this hook returns.
     */
    toPrefix?: (suffix: string) => string;
    /** The widget's OWN keys for one session, beyond the Properties. */
    toOwnSettingNames?: (suffix: string) => string[];
    /**
     * Whether that session has something on a screen. Only one session is
     * rendered at a time, so without this the strip is the one place a live
     * overlay belonging to a session nobody is looking at leaves a mark.
     * `sessionIds` is the strip as it stands, for `checkIsSessionData`.
     */
    checkIsOnScreen: (
        sessionId: string,
        suffix: string,
        sessionIds: string[],
    ) => boolean;
    /**
     * Take that session's overlay OFF every screen. Called before the session
     * is removed: once it is gone, nothing knows which entry was its, and the
     * words sit on the projector with no way back off but Clear Foreground.
     */
    hideSession: (
        sessionId: string,
        suffix: string,
        sessionIds: string[],
    ) => void;
};

export function useForegroundSessions(props: ForegroundSessionsPropsType) {
    const target = `foreground-${props.widgetKey}`;
    const {
        sessions,
        activeId,
        setActiveId,
        addSession,
        renameSession,
        removeSession,
    } = useMediaSessions(target);
    const suffix = toSessionSuffix(activeId);
    const sessionIds = sessions.map((session) => {
        return session.id;
    });
    const propsRef = useAppCurrentRef(props);
    const sessionIdsRef = useAppCurrentRef(sessionIds);
    const removeSessionRef = useAppCurrentRef(removeSession);
    const handleSessionRemoving = useCallback((sessionId: string) => {
        const currentProps = propsRef.current;
        // The strip BEFORE the removal: an overlay that falls to the first
        // session (see `toOwnerSessionId`) goes down with that session.
        currentProps.hideSession(
            sessionId,
            toSessionSuffix(sessionId),
            sessionIdsRef.current,
        );
        removeSessionRef.current(sessionId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const genRemovedSettingNames = useCallback((sessionId: string) => {
        const currentProps = propsRef.current;
        const sessionSuffix = toSessionSuffix(sessionId);
        const propsPrefix = currentProps.toPrefix?.(sessionSuffix);
        return [
            ...(propsPrefix === undefined
                ? []
                : genForegroundPropsSettingNames(propsPrefix)),
            ...(currentProps.toOwnSettingNames?.(sessionSuffix) ?? []),
        ];
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return {
        activeId,
        sessionIds,
        suffix,
        prefix: props.toPrefix?.(suffix) ?? '',
        element: (
            <MediaSessionsComp
                target={target}
                sessions={sessions}
                activeId={activeId}
                onChoose={setActiveId}
                onAdd={addSession}
                onRename={renameSession}
                onRemove={handleSessionRemoving}
                genRemovedSettingNames={genRemovedSettingNames}
                genSessionState={(sessionId) => {
                    return {
                        isOnScreen: props.checkIsOnScreen(
                            sessionId,
                            toSessionSuffix(sessionId),
                            sessionIds,
                        ),
                        // None of these widgets runs a slide show: a countdown
                        // and a marquee are one item that stays up.
                        isAutoPlaying: false,
                    };
                }}
            />
        ),
    };
}

/**
 * Which session put this single-slot overlay up.
 *
 * A countdown, a stopwatch, a marquee and a quick text hold ONE entry per
 * screen, so an item carries the session's id rather than the session owning a
 * list of its own. An entry with no id at all is the Default session's -- it
 * was put there by a drag, a run-sheet row or the assistant, none of which
 * knows about sessions, and Default is where the panel's own controls for it
 * live.
 *
 * Default can be removed, though, and an id can name a session that is gone.
 * Such an entry belongs to the FIRST session in `sessionIds`, the one the
 * strip itself falls back to: every overlay has exactly one tab marking it
 * and one Hide row that takes it down, and none is left reachable only by
 * Clear Foreground.
 */
export function toOwnerSessionId(data: { id?: string }, sessionIds: string[]) {
    const sessionId = data.id ?? DEFAULT_SESSION_ID;
    if (sessionIds.length === 0 || sessionIds.includes(sessionId)) {
        return sessionId;
    }
    return sessionIds[0];
}

export function checkIsSessionData(
    data: { id?: string },
    sessionId: string,
    sessionIds: string[],
) {
    return toOwnerSessionId(data, sessionIds) === sessionId;
}

/**
 * What ONE session of a single-slot widget has on the screens.
 *
 * Both the panel's Hide row and a Properties change act on this list, never
 * on every entry of that KIND. The Hide row once listed every one, so
 * Session 2's panel offered `Hide Marquee Bottom` beside a scroll Default had
 * put up, and read as though Session 2 were on the wall. The tab that IS on
 * screen carries the strip's on-screen mark, and its own panel takes it down.
 * Restyling from the unfiltered list handed Session 2's size and colours to
 * Default's overlay.
 */
export function toSessionShowingList<DataType extends { id?: string }>(
    showingScreenIdDataList: [number, DataType][],
    sessionId: string,
    sessionIds: string[],
) {
    return showingScreenIdDataList.filter(([, data]) => {
        return checkIsSessionData(data, sessionId, sessionIds);
    });
}
