import { dirSourceSettingNames } from '../helper/constants';
import {
    DEFAULT_SESSION_ID,
    readSessions,
    resolveActiveSessionId,
    toSessionSuffix,
} from './mediaSessionData';

/**
 * **Folder sessions of the file lists** -- Documents, Presenting Flows,
 * Bibles and Bible Notes carry the same `Default · Session 2 · +` strip the
 * Background tabs do, one folder per session.
 *
 * A list's session target IS its base folder setting
 * (`select-dir-app-document`), so the list lives at
 * `select-dir-app-document-sessions`, the active id at
 * `select-dir-app-document-active-session`, and Session 2's folder at
 * `select-dir-app-document-s<id>` -- every key under the prefix the settings
 * archive already files with that list. The Default session's id is the empty
 * string, so it keeps the very key Path Settings names.
 *
 * Everything here is a setting read, never a disk one: it runs whenever a
 * lyric is made from a verse or a verse is saved from Lookup. It imports no
 * more than the settings, so `Bible`, `Note` and an editor window's boot can
 * ask it; which session holds a given FILE is `folderSessionPathHelpers`.
 */
export const FOLDER_SESSION_BASE_NAMES = [
    dirSourceSettingNames.APP_DOCUMENT,
    dirSourceSettingNames.PRESENTING_FLOW,
    dirSourceSettingNames.BIBLE_PRESENT,
    dirSourceSettingNames.BIBLE_READ,
    dirSourceSettingNames.BIBLE_NOTES,
];

export function toSessionDirSourceSettingName(
    baseSettingName: string,
    sessionId: string,
) {
    return `${baseSettingName}${toSessionSuffix(sessionId)}`;
}

/**
 * The folder setting of the session the operator is on. Whatever is made from
 * OUTSIDE the list -- a lyric from a verse, a verse saved from Lookup, a song
 * the assistant writes, an imported archive -- lands here, so it shows up in
 * the list being looked at instead of in a folder switched away from.
 */
export function getActiveDirSourceSettingName(baseSettingName: string) {
    return toSessionDirSourceSettingName(
        baseSettingName,
        resolveActiveSessionId(baseSettingName),
    );
}

/**
 * The folder setting an editor window reads its `?file=` from: the session
 * its opener named, while that session still exists, else the list's own.
 */
export function toSessionDirSourceSettingNameFromParam(
    baseSettingName: string,
    sessionId: string | null,
) {
    if (
        sessionId === null ||
        sessionId === DEFAULT_SESSION_ID ||
        !readSessions(baseSettingName).some((session) => {
            return session.id === sessionId;
        })
    ) {
        return baseSettingName;
    }
    return toSessionDirSourceSettingName(baseSettingName, sessionId);
}

/**
 * The query parameter an editor window is told its file's session by. Only
 * written for a session other than Default, so a Default document's editor
 * URL is the one it has always been.
 */
export const SESSION_URL_PARAM_NAME = 'session';
