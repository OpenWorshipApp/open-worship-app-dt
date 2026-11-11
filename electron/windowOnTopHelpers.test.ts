import { EventEmitter } from 'node:events';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const electronState = vi.hoisted(() => {
    return {
        createdHandlerList: [] as ((_event: unknown, win: unknown) => void)[],
    };
});

vi.mock('electron', () => ({
    app: {
        on: (
            name: string,
            handler: (_event: unknown, win: unknown) => void,
        ) => {
            if (name === 'browser-window-created') {
                electronState.createdHandlerList.push(handler);
            }
        },
    },
    BrowserWindow: { getAllWindows: () => [] },
}));

import { MARKDOWN_PREVIEW_FILE_PARAM_NAME as RENDERER_MARKDOWN_PARAM } from '../src/markdown-preview/markdownPreviewParamHelpers';
import {
    HOLD_WINDOW_ON_TOP_CHANNEL as RENDERER_HOLD_CHANNEL,
    toHeldPreviewFilePath,
} from '../src/helper/ai/windowOnTopRequestHelpers';
import {
    checkIsHelpPageUrl,
    HOLD_WINDOW_ON_TOP_CHANNEL,
    holdWindowOnTop,
    initWindowOnTopWatch,
    MARKDOWN_PREVIEW_FILE_PARAM_NAME,
    raiseHelpWindows,
    toPreviewWindowFilePath,
    type HoldWindowRequestType,
} from './windowOnTopHelpers';

const HOST = 'https://localhost:3000';
const NOTE_URL = `${HOST}/bibleNote.html?file=Default.own&id=1&uuid=note-1`;
const OTHER_NOTE_URL = `${HOST}/bibleNote.html?file=Default.own&id=2&uuid=note-2`;
const SETTING_URL = `${HOST}/setting.html?uuid=setting`;
const MD_PATH = path.resolve('/data/resources/Default/JHN.3.Love.md');
const PDF_PATH = path.resolve('/data/resources/pdf/JHN.3.pdf');

function genMarkdownUrl(filePath: string) {
    const url = new URL(`${HOST}/markdownPreview.html`);
    url.searchParams.set(MARKDOWN_PREVIEW_FILE_PARAM_NAME, filePath);
    url.searchParams.set('uuid', 'preview');
    return url.toString();
}

function genPdfUrl(filePath: string) {
    const url = pathToFileURL(filePath);
    url.searchParams.set('uuid', path.basename(filePath));
    return url.toString();
}

let lastId = 0;

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

beforeEach(() => {
    vi.useFakeTimers();
});

afterEach(() => {
    // Each test lets go of what it held, so none leaks into the next.
    for (const sender of senderList.splice(0)) {
        hold(sender, {}, null, []);
    }
    vi.useRealTimers();
});

describe('windowOnTopHelpers', () => {
    it('names the channel and the preview parameter as the app does', () => {
        expect(HOLD_WINDOW_ON_TOP_CHANNEL).toBe(RENDERER_HOLD_CHANNEL);
        expect(MARKDOWN_PREVIEW_FILE_PARAM_NAME).toBe(RENDERER_MARKDOWN_PARAM);
    });

    it('tells the help pages by their page', () => {
        expect(checkIsHelpPageUrl(`${HOST}/chatbot.html?uuid=chatbot`)).toBe(
            true,
        );
        expect(checkIsHelpPageUrl(`${HOST}/aichat.html?uuid=aichat_1`)).toBe(
            true,
        );
        expect(checkIsHelpPageUrl(NOTE_URL)).toBe(false);
        expect(checkIsHelpPageUrl('not a url')).toBe(false);
    });

    it('reads the file a preview window shows', () => {
        expect(toPreviewWindowFilePath(genMarkdownUrl(MD_PATH))).toBe(MD_PATH);
        expect(toPreviewWindowFilePath(genPdfUrl(PDF_PATH))).toBe(PDF_PATH);
        expect(toPreviewWindowFilePath(SETTING_URL)).toBeNull();
        expect(
            toPreviewWindowFilePath(pathToFileURL(MD_PATH).toString()),
        ).toBeNull();
        expect(toPreviewWindowFilePath('not a url')).toBeNull();
    });

    it("picks the tab's newest file that has a window of its own", () => {
        expect(
            toHeldPreviewFilePath([PDF_PATH, '/a/picture.png', MD_PATH]),
        ).toBe(MD_PATH);
        expect(toHeldPreviewFilePath([PDF_PATH, '/a/notes.txt'])).toBe(
            PDF_PATH,
        );
        expect(toHeldPreviewFilePath(['/a/picture.png', undefined])).toBeNull();
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
        hold(helpWin.webContents, { url: NOTE_URL }, mainWin, windowList);
        expect(note.parentWin).toBe(mainWin);
        expect(helpWin.raiseCount).toBe(1);
        // Brought to the front, the note window goes back under the help.
        note.emit('focus');
        expect(helpWin.raiseCount).toBe(2);
        // The same window said again changes nothing.
        hold(helpWin.webContents, { url: NOTE_URL }, mainWin, windowList);
        expect(helpWin.raiseCount).toBe(2);
        hold(helpWin.webContents, {}, mainWin, windowList);
        expect(note.parentWin).toBeNull();
        expect(note.listenerCount('focus')).toBe(0);
        expect(note.listenerCount('closed')).toBe(0);
        expect(helpWin.webContents.listenerCount('destroyed')).toBe(0);
        note.emit('focus');
        expect(helpWin.raiseCount).toBe(2);
    });

    it('holds every kind of window the tab works in', () => {
        const mainWin = new FakeWindow(`${HOST}/presenter.html`);
        const helpWin = genHelpWindow();
        const setting = new FakeWindow(SETTING_URL);
        const reader = new FakeWindow(`${HOST}/reader.html?uuid=reader`);
        const lyric = new FakeWindow(`${HOST}/lyricEditor.html?uuid=lyric`);
        const windowList = [mainWin, helpWin, setting, reader, lyric];
        for (const win of [setting, reader, lyric]) {
            hold(
                helpWin.webContents,
                { url: win.webContents.getURL() },
                mainWin,
                windowList,
            );
            expect(win.parentWin).toBe(mainWin);
        }
        // Only the last asked for is held.
        expect(setting.parentWin).toBeNull();
        expect(reader.parentWin).toBeNull();
    });

    it("holds an attached file's preview window beside the window it works in", () => {
        const mainWin = new FakeWindow(`${HOST}/reader.html`);
        const helpWin = genHelpWindow();
        const setting = new FakeWindow(SETTING_URL);
        const markdown = new FakeWindow(genMarkdownUrl(MD_PATH));
        const pdf = new FakeWindow(genPdfUrl(PDF_PATH));
        const windowList = [mainWin, helpWin, setting, markdown, pdf];
        hold(
            helpWin.webContents,
            { url: SETTING_URL, filePath: MD_PATH },
            mainWin,
            windowList,
        );
        expect(setting.parentWin).toBe(mainWin);
        expect(markdown.parentWin).toBe(mainWin);
        expect(pdf.parentWin).toBeNull();
        // Another file attached: its PDF is held, the Markdown let go.
        hold(helpWin.webContents, { filePath: PDF_PATH }, mainWin, windowList);
        expect(setting.parentWin).toBeNull();
        expect(markdown.parentWin).toBeNull();
        expect(pdf.parentWin).toBe(mainWin);
    });

    it('holds no main window, no page help cannot work in, no closed window', () => {
        const mainWin = new FakeWindow(`${HOST}/reader.html`);
        const helpWin = genHelpWindow();
        const screen = new FakeWindow(`${HOST}/screen.html?screenId=0`);
        hold(
            helpWin.webContents,
            { url: screen.webContents.getURL() },
            mainWin,
            [mainWin, screen],
        );
        expect(screen.parentWin).toBeNull();
        hold(
            helpWin.webContents,
            { url: mainWin.webContents.getURL() },
            mainWin,
            [mainWin],
        );
        expect(mainWin.parentWin).toBeNull();
        const note = new FakeWindow(NOTE_URL);
        hold(helpWin.webContents, { url: OTHER_NOTE_URL }, mainWin, [
            mainWin,
            note,
        ]);
        expect(note.parentWin).toBeNull();
        // With no main window there is nothing to hold it over.
        hold(helpWin.webContents, { url: NOTE_URL }, null, [note]);
        expect(note.parentWin).toBeNull();
        expect(helpWin.raiseCount).toBe(0);
    });

    it('gives back the parent the window had', () => {
        const mainWin = new FakeWindow(`${HOST}/reader.html`);
        const helpWin = genHelpWindow();
        const note = new FakeWindow(NOTE_URL);
        note.parentWin = mainWin;
        const windowList = [mainWin, helpWin, note];
        hold(helpWin.webContents, { url: NOTE_URL }, mainWin, windowList);
        hold(helpWin.webContents, {}, mainWin, windowList);
        expect(note.parentWin).toBe(mainWin);
    });

    it('lets go when the help window goes', () => {
        const mainWin = new FakeWindow(`${HOST}/reader.html`);
        const helpWin = genHelpWindow();
        const note = new FakeWindow(NOTE_URL);
        hold(helpWin.webContents, { url: NOTE_URL }, mainWin, [
            mainWin,
            helpWin,
            note,
        ]);
        helpWin.webContents.destroy();
        expect(note.parentWin).toBeNull();
        expect(note.listenerCount('focus')).toBe(0);
        expect(note.listenerCount('closed')).toBe(0);
    });

    it('holds a window that loads after the ask, and again once reopened', () => {
        initWindowOnTopWatch();
        const [handleCreated] = electronState.createdHandlerList.slice(-1);
        const mainWin = new FakeWindow(`${HOST}/reader.html`);
        const helpWin = genHelpWindow();
        const windowList: FakeWindow[] = [mainWin, helpWin];
        const openWindow = (url: string) => {
            const win = new FakeWindow('');
            handleCreated({}, win);
            windowList.push(win);
            // Its address is known once it has loaded.
            win.webContents.url = url;
            win.webContents.emit('did-finish-load');
            return win;
        };
        hold(helpWin.webContents, { filePath: PDF_PATH }, mainWin, windowList);
        const pdf = openWindow(genPdfUrl(PDF_PATH));
        expect(pdf.parentWin).toBe(mainWin);
        expect(helpWin.raiseCount).toBe(1);
        // Closed, it is forgotten; the ask stays for the next one.
        pdf.close();
        windowList.splice(windowList.indexOf(pdf), 1);
        const reopened = openWindow(genPdfUrl(PDF_PATH));
        expect(reopened.parentWin).toBe(mainWin);
        // A window of another file is not held.
        const other = openWindow(genMarkdownUrl(MD_PATH));
        expect(other.parentWin).toBeNull();
    });

    it('raises the help window again once a new window has had its focus', () => {
        const mainWin = new FakeWindow(`${HOST}/reader.html`);
        const helpWin = genHelpWindow();
        const pdf = new FakeWindow(genPdfUrl(PDF_PATH));
        const windowList = [mainWin, helpWin, pdf];
        hold(helpWin.webContents, { filePath: PDF_PATH }, mainWin, windowList);
        expect(helpWin.raiseCount).toBe(1);
        // A popup's own focus, 100 ms after it was made, can put it on top
        // with no `focus` event: the help window goes over it once more.
        vi.advanceTimersByTime(299);
        expect(helpWin.raiseCount).toBe(1);
        vi.advanceTimersByTime(1);
        expect(helpWin.raiseCount).toBe(2);
        // Let go of before then, nothing more is raised.
        const note = new FakeWindow(NOTE_URL);
        windowList.push(note);
        hold(helpWin.webContents, { url: NOTE_URL }, mainWin, windowList);
        expect(helpWin.raiseCount).toBe(3);
        hold(helpWin.webContents, {}, mainWin, windowList);
        vi.advanceTimersByTime(300);
        expect(helpWin.raiseCount).toBe(3);
    });
});
