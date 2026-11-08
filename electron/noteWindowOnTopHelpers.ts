/**
 * The Bible note window the help window works in stays above the MAIN
 * window, under the help and AI Chat windows (2026-11-08, the user, the
 * help's **Working in** reading _Bible Note … · own window_ and an arrow to
 * the note window's **Toggle Always On Top**: _a bible note window that
 * attached to chatbot should toggled for stay on top_; then, the same hour:
 * _change the bible note stay on top to be top of the main app window
 * instead and still make chatbot and ai chat be the highest stack_). A press
 * in the help window or the main one had buried the note the conversation
 * is changing behind the main window.
 *
 * Held, the note window is made a CHILD of the main window -- always above
 * it, but over no other program the way the OS's always-on-top was -- and
 * every help and AI Chat window is raised over it whenever it comes to the
 * front, so those stay the highest of the app's windows. The help window
 * says which note window its tab in front works in -- its address, or
 * `null` for none -- and the hold ends with that: another tab or window
 * chosen, the note window closed, or the help window gone. Let go, the note
 * window gets back the parent it had (none). Its own **Toggle Always On
 * Top** is the person's and is never touched.
 */

import { BrowserWindow, type WebContents } from 'electron';

import { htmlFiles } from './fsServe';

export const HOLD_NOTE_WINDOW_ON_TOP_CHANNEL =
    'main:app:hold-note-window-on-top';

type HoldType = {
    win: BrowserWindow;
    sender: WebContents;
    // The parent it had before, put back when it is let go.
    parentWin: BrowserWindow | null;
    handleFocus: () => void;
    handleGone: () => void;
};

// One per help window -- there is one -- so it never grows.
const holdBySenderId = new Map<number, HoldType>();

// The windows that stay over a held note window.
const HELP_PAGE_LIST: readonly string[] = [htmlFiles.chatbot, htmlFiles.aichat];

function toPageName(url: string) {
    if (!URL.canParse(url)) {
        return '';
    }
    return new URL(url).pathname.split('/').pop() ?? '';
}

export function checkIsNotePageUrl(url: string) {
    return toPageName(url) === htmlFiles.bibleNote;
}

export function checkIsHelpPageUrl(url: string) {
    return HELP_PAGE_LIST.includes(toPageName(url));
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

function releaseHold(senderId: number) {
    const hold = holdBySenderId.get(senderId);
    if (hold === undefined) {
        return;
    }
    holdBySenderId.delete(senderId);
    if (!hold.sender.isDestroyed()) {
        hold.sender.off('destroyed', hold.handleGone);
    }
    const { win, parentWin } = hold;
    if (win.isDestroyed()) {
        return;
    }
    win.off('closed', hold.handleGone);
    win.off('focus', hold.handleFocus);
    if (win.getParentWindow() !== parentWin) {
        win.setParentWindow(
            parentWin !== null && !parentWin.isDestroyed() ? parentWin : null,
        );
    }
}

/**
 * Hold the note window at `url` over the main window for the help window
 * `sender`, letting go of the one it held before; `null`, or an address that
 * is no note window open, holds none.
 */
export function holdNoteWindowOnTop(
    sender: WebContents,
    url: string | null,
    getMainWin: () => BrowserWindow | null,
    getWindowList: () => BrowserWindow[] = () => {
        return BrowserWindow.getAllWindows();
    },
) {
    const mainWin = getMainWin();
    const found =
        typeof url === 'string' && checkIsNotePageUrl(url)
            ? (getWindowList().find((win) => {
                  return (
                      !win.isDestroyed() &&
                      win !== mainWin &&
                      win.webContents.getURL() === url
                  );
              }) ?? null)
            : null;
    if (found !== null && holdBySenderId.get(sender.id)?.win === found) {
        return;
    }
    releaseHold(sender.id);
    if (
        found === null ||
        sender.isDestroyed() ||
        mainWin === null ||
        mainWin.isDestroyed()
    ) {
        return;
    }
    const senderId = sender.id;
    const handleFocus = () => {
        raiseHelpWindows(getWindowList());
    };
    const handleGone = () => {
        releaseHold(senderId);
    };
    holdBySenderId.set(senderId, {
        win: found,
        sender,
        parentWin: found.getParentWindow(),
        handleFocus,
        handleGone,
    });
    found.on('focus', handleFocus);
    found.once('closed', handleGone);
    sender.once('destroyed', handleGone);
    if (found.getParentWindow() !== mainWin) {
        found.setParentWindow(mainWin);
    }
    handleFocus();
}
