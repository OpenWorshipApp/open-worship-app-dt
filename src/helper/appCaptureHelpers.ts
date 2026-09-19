// A photograph of a window the app already has open.
//
// One path, three callers -- the Presenting Control's snapshot button, the
// chatbot's "attach a screenshot", and `owa_screenshot` for an agent driving
// the app from outside. It is a thin wrapper on purpose: the work is
// `capturePage` in the main process (`electron/electronHelpers.ts`), and the
// only thing worth writing down twice is that this photographs the WINDOW's own
// contents, not the desktop -- so a help window sitting on top of the app never
// appears in a picture of the app.

import { electronSendAsync } from '../server/appHelpers';

/**
 * The app window as it looks right now, as a `data:image/png;base64,...` URL.
 * Pass a `screenId` for a projector screen instead; it rejects when that screen
 * is not showing, because then there is no window to photograph.
 */
export function captureAppWindow(screenId?: number) {
    return electronSendAsync<string>(
        'main:app:capture-window',
        screenId === undefined ? {} : { screenId },
    );
}
