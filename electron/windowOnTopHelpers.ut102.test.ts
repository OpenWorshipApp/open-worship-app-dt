/**
 * Holding a window over the main one when a window is already gone: a held
 * window destroyed without its `closed` reaching anyone, and a main window
 * destroyed while it is still the one named. Electron throws on any call to
 * a destroyed window, so the fakes here do too.
 */
import { EventEmitter } from 'node:events';

import { afterEach, describe, expect, it, vi } from 'vitest';

const electronState = vi.hoisted(() => ({ allWindows: [] as unknown[] }));

vi.mock('electron', () => ({
    app: { on: () => {} },
    BrowserWindow: { getAllWindows: () => electronState.allWindows },
}));

import {
    holdWindowOnTop,
    retryHeldWindows,
    toPreviewWindowFilePath,
    type HoldWindowRequestType,
} from './windowOnTopHelpers';

const HOST = 'https://localhost:3000';
const NOTE_URL = `${HOST}/bibleNote.html?file=Default.own&id=1&uuid=note-1`;
const OTHER_NOTE_URL = `${HOST}/bibleNote.html?file=Default.own&id=2&uuid=note-2`;

let lastId = 1000;

class FakeContents extends EventEmitter {
    id = (lastId += 1);
    isGone = false;
    constructor(public url = '') {
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
    parentWin: FakeWindow | null = null;
    raiseCount = 0;
    webContents: FakeContents;
    constructor(url: string) {
        super();
        this.webContents = new FakeContents(url);
    }
    private checkAlive() {
        if (this.isGone) {
            throw new TypeError('Object has been destroyed');
        }
    }
    isDestroyed() {
        return this.isGone;
    }
    isVisible() {
        this.checkAlive();
        return true;
    }
    isMinimized() {
        this.checkAlive();
        return false;
    }
    getParentWindow() {
        this.checkAlive();
        return this.parentWin;
    }
    setParentWindow(parentWin: FakeWindow | null) {
        this.checkAlive();
        this.parentWin = parentWin;
    }
    moveTop() {
        this.checkAlive();
        this.raiseCount += 1;
    }
    override off(name: string, listener: (...args: any[]) => void) {
        this.checkAlive();
        return super.off(name, listener);
    }
}

const helpWinList: FakeWindow[] = [];

function genHelpWindow() {
    const helpWin = new FakeWindow(`${HOST}/chatbot.html?uuid=chatbot`);
    helpWinList.push(helpWin);
    return helpWin;
}

function hold(
    sender: FakeContents,
    request: Partial<HoldWindowRequestType>,
    mainWin: FakeWindow | null,
    windowList: FakeWindow[],
) {
    holdWindowOnTop(
        sender as any,
        { url: null, filePath: null, ...request },
        () => {
            return mainWin as any;
        },
        () => {
            return windowList as any;
        },
    );
}

afterEach(() => {
    electronState.allWindows = [];
    // The help window going lets go of everything it held.
    for (const helpWin of helpWinList.splice(0)) {
        helpWin.webContents.destroy();
    }
});

describe('toPreviewWindowFilePath', () => {
    it('reads no file off a PDF address that names no path', () => {
        // An encoded slash cannot be a path on any system.
        expect(toPreviewWindowFilePath('file:///docs/a%2Fb.pdf')).toBeNull();
    });
});

describe('a window gone without a word', () => {
    it('a held window destroyed before its close was heard is let go untouched', () => {
        const mainWin = new FakeWindow(`${HOST}/reader.html`);
        const helpWin = genHelpWindow();
        const note = new FakeWindow(NOTE_URL);
        const otherNote = new FakeWindow(OTHER_NOTE_URL);
        const windowList = [mainWin, helpWin, note, otherNote];
        hold(helpWin.webContents, { url: NOTE_URL }, mainWin, windowList);
        expect(note.parentWin).toBe(mainWin);

        // Gone, and no `closed` reached the holder.
        note.isGone = true;
        expect(() => {
            hold(
                helpWin.webContents,
                { url: OTHER_NOTE_URL },
                mainWin,
                windowList,
            );
        }).not.toThrow();
        expect(otherNote.parentWin).toBe(mainWin);

        // And it is no longer held: asking for nothing touches it no more.
        expect(() => {
            hold(helpWin.webContents, {}, mainWin, windowList);
        }).not.toThrow();
        expect(otherNote.parentWin).toBeNull();
    });

    it('holds nothing over a main window that is already destroyed', () => {
        const mainWin = new FakeWindow(`${HOST}/reader.html`);
        mainWin.isGone = true;
        const helpWin = genHelpWindow();
        const note = new FakeWindow(NOTE_URL);
        hold(helpWin.webContents, { url: NOTE_URL }, mainWin, [
            mainWin,
            helpWin,
            note,
        ]);
        expect(note.parentWin).toBeNull();
        expect(helpWin.raiseCount).toBe(0);
    });

    it('lets go of what it held once the main window is destroyed', () => {
        const mainWin = new FakeWindow(`${HOST}/reader.html`);
        const helpWin = genHelpWindow();
        const earlierParent = new FakeWindow(`${HOST}/presenter.html`);
        const note = new FakeWindow(NOTE_URL);
        note.parentWin = earlierParent;
        hold(helpWin.webContents, { url: NOTE_URL }, mainWin, [
            mainWin,
            helpWin,
            earlierParent,
            note,
        ]);
        expect(note.parentWin).toBe(mainWin);

        mainWin.isGone = true;
        retryHeldWindows();
        // Back with the parent it had before.
        expect(note.parentWin).toBe(earlierParent);
        // Focused now, it is nobody's to raise over.
        const raisedBefore = helpWin.raiseCount;
        note.emit('focus');
        expect(helpWin.raiseCount).toBe(raisedBefore);
    });

    it("looks among all of Electron's windows when no list is given", () => {
        const mainWin = new FakeWindow(`${HOST}/reader.html`);
        const helpWin = genHelpWindow();
        const note = new FakeWindow(NOTE_URL);
        electronState.allWindows = [mainWin, helpWin, note];
        holdWindowOnTop(
            helpWin.webContents as any,
            { url: NOTE_URL, filePath: null },
            () => {
                return mainWin as any;
            },
        );
        expect(note.parentWin).toBe(mainWin);
    });
});
