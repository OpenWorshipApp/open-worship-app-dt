import { session, webContents } from 'electron';

import { getRootUrl } from './protocolHelpers';
import {
    checkIsVirtualDisplayHost,
    takeVirtualDisplayAudioTarget,
} from './virtualDisplayHostRegistry';

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
 * A virtual display's compositor records itself the same way, but its sound
 * is never echoed: what its screens play belongs to the stream. Its own tab
 * capture does not carry its `<webview>` guests' audio, so it asks for each
 * screen's audio on its own, naming the screen first
 * (`setVirtualDisplayAudioTarget`).
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
            const host = webContents.fromFrame(frame);
            if (checkIsVirtualDisplayHost(host)) {
                // Only an audio request takes the screen it was asked for: the
                // compositor's own picture is asked for without audio.
                const audioFrame = request.audioRequested
                    ? takeVirtualDisplayAudioTarget(host!)
                    : null;
                callback({
                    video: frame,
                    audio: audioFrame ?? undefined,
                    enableLocalEcho: false,
                });
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
