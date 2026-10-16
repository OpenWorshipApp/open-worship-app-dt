/**
 * The app's open windows, for the help window's window picker (2026-10-15,
 * the user's ask with a Bible Reader window open beside the main one:
 * _chatbot work with main window only … Let add window selection (if more
 * child window), after window change the chatbot should work with the
 * selected window_).
 *
 * Each by the id its tools aim with: the DevTools target id, which
 * `pickTarget` (`tools/owa-devtools-mcp/cdp.mjs`) takes as `page`. An address
 * cannot be that handle -- every Bible Reader window opened from the main one
 * is `reader.html?uuid=reader` -- and the main window keeps its id while it
 * moves between the Presenter, the Reader and the Editor.
 *
 * Read off this process's own debugging endpoint when the help window asks
 * (it opens, gains focus, its picker is opened, or it is TOLD a window came,
 * went or changed -- `initAppWindowListWatch` below), never on a timer: one
 * request on the loopback, nothing held.
 */

import { app, BrowserWindow, type WebContents } from 'electron';

import { htmlFiles } from './fsServe';

export type AppWindowEntryType = {
    id: string;
    title: string;
    url: string;
};

const LIST_TIMEOUT_MILLISECONDS = 3000;

export async function listAppWindows(
    port: number | null,
    fetchUrl: typeof fetch = fetch,
): Promise<AppWindowEntryType[]> {
    if (port === null) {
        return [];
    }
    try {
        const response = await fetchUrl(`http://127.0.0.1:${port}/json/list`, {
            signal: AbortSignal.timeout(LIST_TIMEOUT_MILLISECONDS),
        });
        if (!response.ok) {
            return [];
        }
        const list: unknown = await response.json();
        if (!Array.isArray(list)) {
            return [];
        }
        return list
            .filter((target) => {
                return (
                    target?.type === 'page' &&
                    typeof target.id === 'string' &&
                    typeof target.url === 'string' &&
                    !target.url.startsWith('devtools://')
                );
            })
            .map((target) => {
                return {
                    id: target.id,
                    title: typeof target.title === 'string' ? target.title : '',
                    url: target.url,
                };
            });
    } catch (_error) {
        // No list is no picker: the help works with the main window, as it
        // always has.
        return [];
    }
}

// Told to the help window, which then asks for the list again.
export const APP_WINDOWS_CHANGED_CHANNEL = 'main:app:app-windows-changed';
// The pages the help window's picker lists -- the windows of
// `tools/owa-devtools-mcp/botFocus.mjs`, a test holding the two together.
// A print, capture or web-read window opening is not news to it.
export const WATCHED_PAGE_LIST: readonly string[] = [
    htmlFiles.presenter,
    htmlFiles.reader,
    htmlFiles.appDocumentEditor,
    htmlFiles.bibleNote,
    htmlFiles.setting,
    htmlFiles.webEditor,
    htmlFiles.lyricEditor,
    htmlFiles.lwShare,
];
// One burst -- a window that loads AND retitles, a page and its popup --
// is one notice, sent once it has settled: by then the debugging endpoint
// lists the new window with its address, and no longer lists a closed one.
const CHANGE_SETTLE_MILLISECONDS = 300;

export function checkIsWatchedPageUrl(url: string) {
    if (!URL.canParse(url)) {
        return false;
    }
    const pageName = new URL(url).pathname.split('/').pop() ?? '';
    return WATCHED_PAGE_LIST.includes(pageName);
}

function sendToHelpWindows(windowList: BrowserWindow[]) {
    for (const win of windowList) {
        if (
            !win.isDestroyed() &&
            win.webContents.getURL().includes(htmlFiles.chatbot)
        ) {
            win.webContents.send(APP_WINDOWS_CHANGED_CHANNEL);
        }
    }
}

/**
 * Keeps the help window's window picker in step with the app (2026-10-15,
 * the user, Settings opened while the help was up and not in its list: _it
 * should real-time tracking the new opening_). Every app window that loads
 * a listed page, changes its title (a Slide Editor names its document; the
 * main window moves between pages) or closes raises ONE notice to the help
 * windows, after the burst has settled.
 *
 * Pushed, never polled, and nothing is sent while no help window is open:
 * on a low-spec machine a quiet app must cost nothing.
 */
export function initAppWindowListWatch(
    getWindowList: () => BrowserWindow[] = () => {
        return BrowserWindow.getAllWindows();
    },
) {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const notify = () => {
        if (timer !== null) {
            clearTimeout(timer);
        }
        timer = setTimeout(() => {
            timer = null;
            sendToHelpWindows(getWindowList());
        }, CHANGE_SETTLE_MILLISECONDS);
    };
    const watch = (win: BrowserWindow) => {
        const contents: WebContents = win.webContents;
        // The address is read while the window is alive: a closed window
        // has none left to read.
        let isWatched = false;
        const handleLoaded = () => {
            isWatched = checkIsWatchedPageUrl(contents.getURL());
            if (isWatched) {
                notify();
            }
        };
        contents.on('did-finish-load', handleLoaded);
        contents.on('page-title-updated', () => {
            if (isWatched) {
                notify();
            }
        });
        win.on('closed', () => {
            if (isWatched) {
                notify();
            }
        });
    };
    app.on('browser-window-created', (_event, win) => {
        watch(win);
    });
}
