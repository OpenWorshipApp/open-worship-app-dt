import DirSource from '../helper/DirSource';
import { pathDirname, pathResolve, pathSeparator } from '../server/fileHelpers';
import {
    DEFAULT_SESSION_ID,
    readSessions,
    resolveActiveSessionId,
} from './mediaSessionData';
import { toSessionDirSourceSettingName } from './folderSessionHelpers';

// Windows paths compare without case: `C:\Docs` and `c:\docs` are one folder.
function toComparablePath(dirPath: string) {
    const resolved = pathResolve(dirPath);
    return pathSeparator === '\\' ? resolved.toLowerCase() : resolved;
}

/**
 * Which session of a list holds a file, judged by the file's folder alone.
 * The active session is asked first, so two sessions on one folder answer the
 * one being looked at. `null` when no session's folder holds it.
 *
 * Used where a file leaves the list for another window by NAME -- an editor
 * popup's `?file=` -- and that window has to know which folder to read it
 * from.
 */
export function findSessionIdByFilePath(
    baseSettingName: string,
    filePath: string,
) {
    const fileDirPath = toComparablePath(pathDirname(filePath));
    const activeId = resolveActiveSessionId(baseSettingName);
    const sessionIds = readSessions(baseSettingName).map((session) => {
        return session.id;
    });
    const orderedIds = [
        activeId,
        ...sessionIds.filter((sessionId) => {
            return sessionId !== activeId;
        }),
    ];
    for (const sessionId of orderedIds) {
        const dirPath = DirSource.getDirPathBySettingName(
            toSessionDirSourceSettingName(baseSettingName, sessionId),
        );
        if (dirPath && toComparablePath(dirPath) === fileDirPath) {
            return sessionId;
        }
    }
    return null;
}

/**
 * The session to name in an editor window's URL for a file of a list: its
 * id, or `null` when the file is in the Default session's folder (or in no
 * session's) and the URL needs nothing added.
 */
export function findNonDefaultSessionIdByFilePath(
    baseSettingName: string,
    filePath: string,
) {
    const sessionId = findSessionIdByFilePath(baseSettingName, filePath);
    return sessionId === null || sessionId === DEFAULT_SESSION_ID
        ? null
        : sessionId;
}
