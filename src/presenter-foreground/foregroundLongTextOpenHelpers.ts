import { getSetting, setSetting } from '../helper/settingHelpers';
import {
    addMediaSession,
    genMediaSessionId,
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
    addMediaSession(toForegroundSessionsTarget(LONG_TEXT_WIDGET_KEY), {
        id: sessionId,
        name: getFileName(baseName) || baseName,
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
