import { getSetting, setSetting } from '../helper/settingHelpers';

/**
 * The stored half of a session strip: what a session IS and which one is
 * active, with no React, no styles and no popups. Kept apart from
 * `MediaSessionsComp` so a model module (`Bible`, `Note`) and an editor
 * window's boot can ask "which folder is the operator on" without pulling the
 * strip's whole UI into their static closure.
 *
 * A **session** is one saved set-up of a list: its own folder, plus whatever
 * else the panel keys by it -- a foreground widget adds its Properties (size,
 * place, blend mode) and its slide show, a Background tab its view mode, its
 * sort and its slide show, a document list its sort and filter. Several of
 * them let one panel hold, say, this Sunday's pictures in one folder and the
 * standing set in another, and switch between them without re-pointing the
 * folder every time.
 *
 * The id is what every one of those settings is keyed by, so it must never
 * change once used. The FIRST session's id is the empty string on purpose:
 * that keeps the keys a panel already wrote before sessions existed -- which
 * is also why a list's Default session is still the folder the Path Settings
 * page points at.
 */
export type MediaSessionType = {
    id: string;
    name: string;
};

export const DEFAULT_SESSION_ID = '';

/**
 * `target` is the whole settings namespace, not a bare kind: the foreground
 * widgets pass `foreground-image`, the Background tabs `background-image`, a
 * file list its own folder setting (`select-dir-app-document`), and no two
 * share a list.
 */
export function toListSettingName(target: string) {
    return `${target}-sessions`;
}
export function toActiveSettingName(target: string) {
    return `${target}-active-session`;
}

export function toSessionSuffix(sessionId: string) {
    return sessionId === DEFAULT_SESSION_ID ? '' : `-${sessionId}`;
}

// Stored as data, in English, the day the list is first written.
export const DEFAULT_SESSION_NAME = 'Default';

export function toDefaultList(): MediaSessionType[] {
    return [{ id: DEFAULT_SESSION_ID, name: DEFAULT_SESSION_NAME }];
}

export function readSessions(target: string): MediaSessionType[] {
    try {
        const raw = getSetting(toListSettingName(target));
        if (!raw) {
            return toDefaultList();
        }
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
            return toDefaultList();
        }
        const list = parsed.filter((item: any) => {
            return (
                item !== null &&
                typeof item === 'object' &&
                typeof item.id === 'string' &&
                typeof item.name === 'string'
            );
        });
        // A hand-edited file must never leave the panel with nothing to show.
        return list.length === 0 ? toDefaultList() : list;
    } catch {
        return toDefaultList();
    }
}

/**
 * The session a list is on: the stored id while it still names a session,
 * otherwise the first one. The strip and every reader outside it answer by
 * this one rule, so a stale id can never send the list to one folder and a
 * "save to Default" to another.
 */
export function pickActiveSession(
    sessions: MediaSessionType[],
    activeId: string,
) {
    return (
        sessions.find((session) => {
            return session.id === activeId;
        }) ?? sessions[0]
    );
}

export function resolveActiveSessionId(target: string) {
    const activeId =
        getSetting(toActiveSettingName(target)) ?? DEFAULT_SESSION_ID;
    return pickActiveSession(readSessions(target), activeId).id;
}

/**
 * A new session's id. Ids are never reused: every setting a removed session
 * wrote is keyed by its id, and a recycled one would inherit them.
 */
export function genMediaSessionId() {
    return `s${Date.now().toString(36)}`;
}

// The mounted strips of each target in this window, so a change made by one
// -- or from outside every strip, a lyric's `Long Text Show` adding a session
// -- is drawn by all of them: the Bibles list is up twice in one Presenter
// window (the right column and the Lookup popup) on one target. An entry
// leaves when its strip unmounts, so this holds only what is on screen.
const sessionRefresherMap = new Map<string, Set<() => void>>();

export function subscribeMediaSessionStrips(
    target: string,
    refresh: () => void,
) {
    let refresherSet = sessionRefresherMap.get(target);
    if (refresherSet === undefined) {
        refresherSet = new Set();
        sessionRefresherMap.set(target, refresherSet);
    }
    const currentRefresherSet = refresherSet;
    currentRefresherSet.add(refresh);
    return () => {
        currentRefresherSet.delete(refresh);
        if (currentRefresherSet.size === 0) {
            sessionRefresherMap.delete(target);
        }
    };
}

export function notifyMediaSessionStrips(target: string) {
    // Copied: a refresh can unmount a strip, which edits the set mid-loop.
    for (const refresh of Array.from(sessionRefresherMap.get(target) ?? [])) {
        refresh();
    }
}

/**
 * Adds a session to a strip and makes it the active one, whether the strip is
 * mounted or not: a mounted one is told, any other reads it when it mounts.
 * Whatever the session's own settings are to hold is written BEFORE this: the
 * panel switching to it reads them on the spot.
 */
export function addMediaSession(target: string, session: MediaSessionType) {
    setSetting(
        toListSettingName(target),
        JSON.stringify([...readSessions(target), session]),
    );
    setSetting(toActiveSettingName(target), session.id);
    notifyMediaSessionStrips(target);
}
