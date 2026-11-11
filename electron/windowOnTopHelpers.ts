/**
 * The windows the help window works on stay above the MAIN window, under the
 * help and AI Chat windows.
 *
 * First a Bible note's window (2026-11-08, the user, the help's **Working
 * in** reading _Bible Note … · own window_ and an arrow to the note window's
 * **Toggle Always On Top**: _a bible note window that attached to chatbot
 * should toggled for stay on top_; then, the same hour: _change the bible
 * note stay on top to be top of the main app window instead and still make
 * chatbot and ai chat be the highest stack_). Then a Resources file's preview
 * (2026-11-10, the 🤖 on a PDF and a Markdown row circled: _like bible note I
 * want behavior of during attached to chatbot the window have to be on top of
 * main window_), and every kind of window with it: _this behavior should apply
 * to all window types, imagine chatbot working on an attached window but the
 * window is covered by main window that's wrong behavior_. A press in the help
 * window or the main one had buried the window being worked on behind the
 * main window.
 *
 * The help window asks for two things (`HoldWindowRequestType` in
 * `src/helper/ai/windowOnTopRequestHelpers.ts`): `url`, the window its tab in
 * front works in -- any page it can work in (`WATCHED_PAGE_LIST`), never the
 * main window -- and `filePath`, a file attached in that tab, whose own
 * Markdown Preview or PDF window is found here from the file. Held, a window
 * is made a CHILD of the main window -- always above it, but over no other
 * program the way the OS's always-on-top was -- and every help and AI Chat
 * window is raised over it whenever it comes to the front, so those stay the
 * highest of the app's windows.
 *
 * The ask is KEPT until the help window asks for something else or goes: a
 * window it names that opens or loads later -- a PDF reopened from its row,
 * the preview the 🤖 opens as the chat opens -- is held once it has loaded
 * (`initWindowOnTopWatch`). Let go, a window gets back the parent it had. Its
 * own **Toggle Always On Top** is the person's and is never touched.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { app, BrowserWindow, type WebContents } from 'electron';

import { checkIsWatchedPageUrl } from './appWindowListHelpers';
import { htmlFiles } from './fsServe';

export const HOLD_WINDOW_ON_TOP_CHANNEL = 'main:app:hold-window-on-top';
// The Markdown Preview window's file parameter
// (`src/markdown-preview/markdownPreviewParamHelpers.ts`; the test holds the
// two equal).
export const MARKDOWN_PREVIEW_FILE_PARAM_NAME = 'preview-file';

export type HoldWindowRequestType = {
    url: string | null;
    filePath: string | null;
};

type HeldType = {
    win: BrowserWindow;
    // The parent it had before, put back when it is let go.
    parentWin: BrowserWindow | null;
    handleFocus: () => void;
    handleClosed: () => void;
};

type WantType = {
    sender: WebContents;
    request: HoldWindowRequestType;
    getMainWin: () => BrowserWindow | null;
    getWindowList: () => BrowserWindow[];
    heldList: HeldType[];
    handleGone: () => void;
    raiseTimer: ReturnType<typeof setTimeout> | null;
};

// One per help window -- there is one -- so it never grows.
const wantBySenderId = new Map<number, WantType>();

// A popup is focused 100 ms after it is made (`createPopupWindow` in
// `electronHelpers.ts`), and on Windows that call puts it at the top FIRST:
// when the OS then will not hand it the foreground, no `focus` event follows
// to raise the help window back over it. Seen live 2026-11-10, a PDF reopened
// from its row came up over the help window. A window just held is raised
// over once more, after that focus.
const RAISE_AGAIN_MILLISECONDS = 300;

// The windows that stay over a held window.
const HELP_PAGE_LIST: readonly string[] = [htmlFiles.chatbot, htmlFiles.aichat];

function toUrlObject(url: string) {
    return URL.canParse(url) ? new URL(url) : null;
}

function toPageName(url: string) {
    return toUrlObject(url)?.pathname.split('/').pop() ?? '';
}

export function checkIsHelpPageUrl(url: string) {
    return HELP_PAGE_LIST.includes(toPageName(url));
}

// A file named the same way whatever the slashes, and in any case where the
// disk does not tell cases apart.
function toPathKey(filePath: string) {
    const resolved = path.resolve(filePath);
    return process.platform === 'linux' ? resolved : resolved.toLowerCase();
}

/**
 * The file a window shows in a window of its own: a Markdown Preview's, or
 * the PDF the viewer was opened on (`file:///…/JHN.3.pdf?uuid=JHN.3.pdf`).
 */
export function toPreviewWindowFilePath(url: string) {
    const urlObject = toUrlObject(url);
    if (urlObject === null) {
        return null;
    }
    if (toPageName(url) === htmlFiles.markdownPreview) {
        return urlObject.searchParams.get(MARKDOWN_PREVIEW_FILE_PARAM_NAME);
    }
    if (
        urlObject.protocol !== 'file:' ||
        !urlObject.pathname.toLowerCase().endsWith('.pdf')
    ) {
        return null;
    }
    urlObject.search = '';
    urlObject.hash = '';
    try {
        return fileURLToPath(urlObject);
    } catch (_error) {
        return null;
    }
}

/** Every help and AI Chat window on screen, over whatever came up. */
export function raiseHelpWindows(windowList: BrowserWindow[]) {
    for (const win of windowList) {
        if (
            !win.isDestroyed() &&
            win.isVisible() &&
            !win.isMinimized() &&
            checkIsHelpPageUrl(win.webContents.getURL())
        ) {
            win.moveTop();
        }
    }
}

/** The open windows an ask names, the main window never among them. */
export function findWantedWindows(
    request: HoldWindowRequestType,
    mainWin: BrowserWindow,
    windowList: BrowserWindow[],
) {
    const url =
        request.url !== null && checkIsWatchedPageUrl(request.url)
            ? request.url
            : null;
    const fileKey =
        request.filePath === null ? null : toPathKey(request.filePath);
    if (url === null && fileKey === null) {
        return [];
    }
    return windowList.filter((win) => {
        if (win.isDestroyed() || win === mainWin) {
            return false;
        }
        const winUrl = win.webContents.getURL();
        if (url !== null && winUrl === url) {
            return true;
        }
        if (fileKey === null) {
            return false;
        }
        const previewFilePath = toPreviewWindowFilePath(winUrl);
        return (
            previewFilePath !== null && toPathKey(previewFilePath) === fileKey
        );
    });
}

function releaseHeld(want: WantType, held: HeldType) {
    want.heldList = want.heldList.filter((item) => {
        return item !== held;
    });
    const { win, parentWin } = held;
    if (win.isDestroyed()) {
        return;
    }
    win.off('closed', held.handleClosed);
    win.off('focus', held.handleFocus);
    if (win.getParentWindow() !== parentWin) {
        win.setParentWindow(
            parentWin !== null && !parentWin.isDestroyed() ? parentWin : null,
        );
    }
}

function holdOne(want: WantType, win: BrowserWindow, mainWin: BrowserWindow) {
    const held: HeldType = {
        win,
        parentWin: win.getParentWindow(),
        handleFocus: () => {
            raiseHelpWindows(want.getWindowList());
        },
        // Gone with its window; the ask stays, for a window opened again.
        handleClosed: () => {
            want.heldList = want.heldList.filter((item) => {
                return item !== held;
            });
        },
    };
    want.heldList.push(held);
    win.on('focus', held.handleFocus);
    win.once('closed', held.handleClosed);
    if (win.getParentWindow() !== mainWin) {
        win.setParentWindow(mainWin);
    }
}

function applyWant(want: WantType) {
    const mainWin = want.getMainWin();
    const windowList = want.getWindowList();
    let foundList =
        mainWin === null || want.sender.isDestroyed()
            ? []
            : findWantedWindows(want.request, mainWin, windowList);
    // Nothing to hold it over.
    if (foundList.length > 0 && mainWin?.isDestroyed() !== false) {
        foundList = [];
    }
    for (const held of [...want.heldList]) {
        if (!foundList.includes(held.win)) {
            releaseHeld(want, held);
        }
    }
    let isAnyNew = false;
    for (const win of foundList) {
        if (
            mainWin === null ||
            want.heldList.some((held) => {
                return held.win === win;
            })
        ) {
            continue;
        }
        holdOne(want, win, mainWin);
        isAnyNew = true;
    }
    if (isAnyNew) {
        raiseHelpWindows(windowList);
        raiseAgainLater(want);
    }
}

function clearRaiseTimer(want: WantType) {
    if (want.raiseTimer !== null) {
        clearTimeout(want.raiseTimer);
        want.raiseTimer = null;
    }
}

function raiseAgainLater(want: WantType) {
    clearRaiseTimer(want);
    want.raiseTimer = setTimeout(() => {
        want.raiseTimer = null;
        if (want.heldList.length > 0) {
            raiseHelpWindows(want.getWindowList());
        }
    }, RAISE_AGAIN_MILLISECONDS);
}

function forgetWant(senderId: number) {
    const want = wantBySenderId.get(senderId);
    if (want === undefined) {
        return;
    }
    wantBySenderId.delete(senderId);
    clearRaiseTimer(want);
    if (!want.sender.isDestroyed()) {
        want.sender.off('destroyed', want.handleGone);
    }
    for (const held of [...want.heldList]) {
        releaseHeld(want, held);
    }
}

/**
 * Hold over the main window what the help window `sender` works on, letting
 * go of what it held before; an ask of nothing lets go of everything.
 */
export function holdWindowOnTop(
    sender: WebContents,
    request: HoldWindowRequestType,
    getMainWin: () => BrowserWindow | null,
    getWindowList: () => BrowserWindow[] = () => {
        return BrowserWindow.getAllWindows();
    },
) {
    if (
        (request.url === null && request.filePath === null) ||
        sender.isDestroyed()
    ) {
        forgetWant(sender.id);
        return;
    }
    let want = wantBySenderId.get(sender.id);
    if (want === undefined) {
        const senderId = sender.id;
        want = {
            sender,
            request,
            getMainWin,
            getWindowList,
            heldList: [],
            handleGone: () => {
                forgetWant(senderId);
            },
            raiseTimer: null,
        };
        wantBySenderId.set(senderId, want);
        sender.once('destroyed', want.handleGone);
    } else {
        Object.assign(want, { request, getMainWin, getWindowList });
    }
    applyWant(want);
}

/** Every ask looked at again: a window has loaded, maybe one it names. */
export function retryHeldWindows() {
    for (const want of [...wantBySenderId.values()]) {
        applyWant(want);
    }
}

/**
 * A window that loads after the ask -- the preview the 🤖 opens as the chat
 * opens, a note or a PDF opened again -- is held once it has: the help window
 * says what it wants only when that CHANGES. Nothing is looked at while
 * nothing is asked for.
 */
export function initWindowOnTopWatch() {
    app.on('browser-window-created', (_event, win) => {
        win.webContents.on('did-finish-load', () => {
            if (wantBySenderId.size > 0) {
                retryHeldWindows();
            }
        });
    });
}
