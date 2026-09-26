/** What every foreground show's key starts with -- see `applyAutoPlayRunners`. */
export const FOREGROUND_AUTO_PLAY_KEY_PREFIX = 'foreground-';

/**
 * The settings prefix one foreground component's slide show runs under.
 *
 * It is also the KEY its timer runs under and the key the countdown beside it
 * reads, so it is written in exactly one place: the launcher menu works it out
 * from a widget's key to say where a show is running, and the media panel
 * works it out from its own kind and session. Those two drifting apart is a
 * show the menu reports as stopped while it is still advancing a projector.
 *
 * Its own tiny module because the menu is built from a lazy component list --
 * importing the media panel to reach this one line would pull the whole file
 * grid in with it.
 */
export function toForegroundAutoPlayPrefix(
    widgetKey: string,
    sessionSuffix: string,
) {
    return `${FOREGROUND_AUTO_PLAY_KEY_PREFIX}${widgetKey}${sessionSuffix}`;
}
