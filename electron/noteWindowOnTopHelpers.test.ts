import { EventEmitter } from 'node:events';

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
    BrowserWindow: { getAllWindows: () => [] },
}));

import { HOLD_NOTE_WINDOW_ON_TOP_CHANNEL as RENDERER_HOLD_CHANNEL } from '../src/helper/ai/noteWindowMatchHelpers';
import {
    checkIsHelpPageUrl,
    checkIsNotePageUrl,
    HOLD_NOTE_WINDOW_ON_TOP_CHANNEL,
    holdNoteWindowOnTop,
    raiseHelpWindows,
} from './noteWindowOnTopHelpers';

const HOST = 'https://localhost:3000';
const NOTE_URL = `${HOST}/bibleNote.html?file=Default.own&id=1&uuid=note-1`;
const OTHER_NOTE_URL = `${HOST}/bibleNote.html?file=Default.own&id=2&uuid=note-2`;

let lastId = 0;

class FakeContents extends EventEmitter {
    id = (lastId += 1);
    isGone = false;
    constructor(private url = '') {
        super();
    }
    getURL() {
        return this.url;
    }
    isDestroyed() {
        return this.isGone;
    }
    destroy() {
        this.isGone = true;
        this.emit('destroyed');
    }
}

class FakeWindow extends EventEmitter {
    isGone = false;
    isShown = true;
    isMinimised = false;
    parentWin: FakeWindow | null = null;
    raiseCount = 0;
    webContents: FakeContents;
    constructor(url: string) {
        super();
        this.webContents = new FakeContents(url);
    }
    isDestroyed() {
        return this.isGone;
    }
    isVisible() {
        return this.isShown;
    }
    isMinimized() {
        return this.isMinimised;
    }
    getParentWindow() {
        return this.parentWin;
    }
    setParentWindow(parentWin: FakeWindow | null) {
        this.parentWin = parentWin;
    }
    moveTop() {
        this.raiseCount += 1;
    }
    close() {
        this.isGone = true;
        this.emit('closed');
    }
}

const senderList: FakeContents[] = [];

function genHelpWindow() {
    const helpWin = new FakeWindow(`${HOST}/chatbot.html?uuid=chatbot`);
    senderList.push(helpWin.webContents);
    return helpWin;
}

function hold(
    sender: FakeContents,
    url: string | null,
    mainWin: FakeWindow | null,
    windowList: FakeWindow[],
) {
    holdNoteWindowOnTop(
        sender as any,
        url,
        () => {
            return mainWin as any;
        },
        () => {
            return windowList as any;
        },
    );
}

afterEach(() => {
    // Each test lets go of what it held, so none leaks into the next.
    for (const sender of senderList.splice(0)) {
        hold(sender, null, null, []);
    }
});

describe('noteWindowOnTopHelpers', () => {
    it('names the channel as the help window does', () => {
        expect(HOLD_NOTE_WINDOW_ON_TOP_CHANNEL).toBe(RENDERER_HOLD_CHANNEL);
    });

    it('tells a note page and the help pages by their page', () => {
        expect(checkIsNotePageUrl(NOTE_URL)).toBe(true);
        expect(checkIsNotePageUrl(`${HOST}/reader.html?uuid=r`)).toBe(false);
        expect(checkIsNotePageUrl('not a url')).toBe(false);
        expect(checkIsHelpPageUrl(`${HOST}/chatbot.html?uuid=chatbot`)).toBe(
            true,
        );
        expect(checkIsHelpPageUrl(`${HOST}/aichat.html?uuid=aichat_1`)).toBe(
            true,
        );
        expect(checkIsHelpPageUrl(NOTE_URL)).toBe(false);
    });

    it('raises only the help and AI Chat windows on screen', () => {
        const helpWin = genHelpWindow();
        const aiChatWin = new FakeWindow(`${HOST}/aichat.html?uuid=aichat_1`);
        const hiddenAiChatWin = new FakeWindow(`${HOST}/aichat.html?uuid=b`);
        hiddenAiChatWin.isMinimised = true;
        const note = new FakeWindow(NOTE_URL);
        raiseHelpWindows([helpWin, aiChatWin, hiddenAiChatWin, note] as any);
        expect(helpWin.raiseCount).toBe(1);
        expect(aiChatWin.raiseCount).toBe(1);
        expect(hiddenAiChatWin.raiseCount).toBe(0);
        expect(note.raiseCount).toBe(0);
    });

    it('holds the note window over the main window, under the help', () => {
        const mainWin = new FakeWindow(`${HOST}/reader.html`);
        const helpWin = genHelpWindow();
        const note = new FakeWindow(NOTE_URL);
        const windowList = [mainWin, helpWin, note];
        hold(helpWin.webContents, NOTE_URL, mainWin, windowList);
        expect(note.parentWin).toBe(mainWin);
        expect(helpWin.raiseCount).toBe(1);
        // Brought to the front, the note window goes back under the help.
        note.emit('focus');
        expect(helpWin.raiseCount).toBe(2);
        // The same window said again changes nothing.
        hold(helpWin.webContents, NOTE_URL, mainWin, windowList);
        expect(helpWin.raiseCount).toBe(2);
        hold(helpWin.webContents, null, mainWin, windowList);
        expect(note.parentWin).toBeNull();
        expect(note.listenerCount('focus')).toBe(0);
        expect(note.listenerCount('closed')).toBe(0);
        expect(helpWin.webContents.listenerCount('destroyed')).toBe(0);
        note.emit('focus');
        expect(helpWin.raiseCount).toBe(2);
    });

    it('moves the hold from one note window to the next', () => {
        const mainWin = new FakeWindow(`${HOST}/reader.html`);
        const helpWin = genHelpWindow();
        const note = new FakeWindow(NOTE_URL);
        const other = new FakeWindow(OTHER_NOTE_URL);
        const windowList = [mainWin, helpWin, note, other];
        hold(helpWin.webContents, NOTE_URL, mainWin, windowList);
        hold(helpWin.webContents, OTHER_NOTE_URL, mainWin, windowList);
        expect(note.parentWin).toBeNull();
        expect(other.parentWin).toBe(mainWin);
    });

    it('holds no window that is not a note window, or not open', () => {
        const mainWin = new FakeWindow(`${HOST}/reader.html`);
        const helpWin = genHelpWindow();
        const reader = new FakeWindow(`${HOST}/reader.html?uuid=reader`);
        hold(helpWin.webContents, reader.webContents.getURL(), mainWin, [
            mainWin,
            reader,
        ]);
        expect(reader.parentWin).toBeNull();
        const note = new FakeWindow(NOTE_URL);
        hold(helpWin.webContents, OTHER_NOTE_URL, mainWin, [mainWin, note]);
        expect(note.parentWin).toBeNull();
        // With no main window there is nothing to hold it over.
        hold(helpWin.webContents, NOTE_URL, null, [note]);
        expect(note.parentWin).toBeNull();
        expect(helpWin.raiseCount).toBe(0);
    });

    it('gives back the parent the window had', () => {
        const mainWin = new FakeWindow(`${HOST}/reader.html`);
        const helpWin = genHelpWindow();
        const note = new FakeWindow(NOTE_URL);
        note.parentWin = mainWin;
        const windowList = [mainWin, helpWin, note];
        hold(helpWin.webContents, NOTE_URL, mainWin, windowList);
        hold(helpWin.webContents, null, mainWin, windowList);
        expect(note.parentWin).toBe(mainWin);
    });

    it('lets go when the help window goes', () => {
        const mainWin = new FakeWindow(`${HOST}/reader.html`);
        const helpWin = genHelpWindow();
        const note = new FakeWindow(NOTE_URL);
        hold(helpWin.webContents, NOTE_URL, mainWin, [mainWin, helpWin, note]);
        helpWin.webContents.destroy();
        expect(note.parentWin).toBeNull();
        expect(note.listenerCount('focus')).toBe(0);
        expect(note.listenerCount('closed')).toBe(0);
    });

    it('forgets a note window that closed', () => {
        const mainWin = new FakeWindow(`${HOST}/reader.html`);
        const helpWin = genHelpWindow();
        const note = new FakeWindow(NOTE_URL);
        hold(helpWin.webContents, NOTE_URL, mainWin, [mainWin, helpWin, note]);
        note.close();
        expect(helpWin.webContents.listenerCount('destroyed')).toBe(0);
        // A window opened at the same address later is held afresh.
        const reopened = new FakeWindow(NOTE_URL);
        hold(helpWin.webContents, NOTE_URL, mainWin, [
            mainWin,
            helpWin,
            reopened,
        ]);
        expect(reopened.parentWin).toBe(mainWin);
    });
});
