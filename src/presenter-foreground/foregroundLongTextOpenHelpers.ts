import { getSetting, setSetting } from '../helper/settingHelpers';
import {
    addMediaSession,
    genMediaSessionId,
    readSessions,
    toSessionSuffix,
} from '../media-sessions/MediaSessionsComp';
import { getFileName, pathBasename } from '../server/fileHelpers';
import {
    LONG_TEXT_WIDGET_KEY,
    genLyricLongTextSession,
    serializeLongTextSession,
    toLongTextSettingName,
} from './foregroundLongTextHelpers';
import { toForegroundSessionsTarget } from './foregroundSessionHelpers';
import {
    FOREGROUND_OPEN_PANELS_SETTING_NAME,
    requestForegroundPanelOpening,
    toOpenedPanelKeys,
} from './foregroundWidgetHelpers';

/**
 * `name`, or `name (2)`, `name (3)`... -- whichever no session has yet. Each
 * press of a song's Long Text Show adds a session named after the song, and
 * three of them read `Still · Still · Still`: chips nobody could tell apart.
 */
export function toUniqueSessionName(name: string, takenNameList: string[]) {
    const takenNameSet = new Set(takenNameList);
    if (!takenNameSet.has(name)) {
        return name;
    }
    let index = 2;
    while (takenNameSet.has(`${name} (${index})`)) {
        index++;
    }
    return `${name} (${index})`;
}

/**
 * A lyric of the Documents list straight into Long Text Show: a NEW session,
 * named after the song, holding the file as its English card, and the panel
 * opened on it -- one press from the song to a Show button that is enabled
 * the moment the card has read the file.
 *
 * Always a new session, never the one open: that one may hold a text somebody
 * typed, or be on a screen.
 */
export function openLyricInLongTextShow(lyricFilePath: string) {
    const sessionId = genMediaSessionId();
    // Written FIRST: the panel switching to the session reads it on the spot.
    setSetting(
        toLongTextSettingName(toSessionSuffix(sessionId)),
        serializeLongTextSession(genLyricLongTextSession(lyricFilePath)),
    );
    const baseName = pathBasename(lyricFilePath);
    const target = toForegroundSessionsTarget(LONG_TEXT_WIDGET_KEY);
    addMediaSession(target, {
        id: sessionId,
        name: toUniqueSessionName(
            getFileName(baseName) || baseName,
            readSessions(target).map((session) => {
                return session.name;
            }),
        ),
    });
    if (!requestForegroundPanelOpening(LONG_TEXT_WIDGET_KEY)) {
        setSetting(
            FOREGROUND_OPEN_PANELS_SETTING_NAME,
            toOpenedPanelKeys(
                getSetting(FOREGROUND_OPEN_PANELS_SETTING_NAME) ?? '',
                LONG_TEXT_WIDGET_KEY,
            ),
        );
    }
}
