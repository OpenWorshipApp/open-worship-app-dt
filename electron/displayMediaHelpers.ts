import { session } from 'electron';

import { getRootUrl } from './protocolHelpers';

/**
 * Chromium refuses `navigator.mediaDevices.getDisplayMedia()` in Electron until
 * a handler answers the request — without one it rejects with
 * `NotSupportedError: Not supported`, which also puts Region Capture
 * (`track.cropTo`) and Element Capture (`track.restrictTo`) out of reach.
 *
 * Handing back the *requesting frame* makes the capture a self tab-capture,
 * which is the only surface those two APIs accept: they crop/restrict a capture
 * of your own page down to one element, which is how the pixels of a
 * cross-origin `<iframe>` (a YouTube player) can be mirrored out even though
 * nothing else in the platform will hand them over.
 *
 * `audio: frame` captures that frame's own audio rather than the whole system,
 * and `enableLocalEcho` keeps it playing out of the speakers while captured.
 *
 * Only the app's own pages are answered. A cross-origin child frame cannot
 * normally reach this handler at all (it would need `allow="display-capture"`
 * delegated to it, which no window here does), but a capture of the operator's
 * screen is not a thing to grant on an origin check we did not write down.
 */
export function initDisplayMediaHandler() {
    const rootUrl = getRootUrl();
    session.defaultSession.setDisplayMediaRequestHandler(
        (request, callback) => {
            const { frame } = request;
            if (frame === null || !request.securityOrigin.startsWith(rootUrl)) {
                // An empty answer is how this API says "denied"; the renderer sees
                // the promise reject.
                callback({});
                return;
            }
            callback({
                video: request.videoRequested ? frame : undefined,
                audio: request.audioRequested ? frame : undefined,
                enableLocalEcho: true,
            });
        },
    );
}
