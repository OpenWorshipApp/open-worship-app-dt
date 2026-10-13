import { EventEmitter } from 'node:events';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { appMock } = vi.hoisted(() => {
    return { appMock: { on: vi.fn() } };
});
vi.mock('electron', () => ({ app: appMock }));

import {
    getRecentConsoleLines,
    initConsoleLog,
    resetConsoleLogForTests,
    toConsoleLine,
} from './consoleLogHelpers';

let lastId = 0;
function genContents(type = 'window') {
    const contents = new EventEmitter() as EventEmitter & {
        id: number;
        getType: () => string;
        isDestroyed: () => boolean;
    };
    contents.id = lastId += 1;
    contents.getType = () => type;
    contents.isDestroyed = () => false;
    return contents;
}

// The listener `initConsoleLog` hands to the app, called as Electron would.
function createContents(type = 'window') {
    const contents = genContents(type);
    const [, listener] = appMock.on.mock.calls[0];
    listener({}, contents);
    return contents;
}

describe('the console a problem report quotes', () => {
    beforeEach(() => {
        appMock.on.mockClear();
        resetConsoleLogForTests();
        initConsoleLog();
    });

    it('keeps errors and warnings, however Electron tells them, and nothing else', () => {
        expect(appMock.on).toHaveBeenCalledWith(
            'web-contents-created',
            expect.any(Function),
        );
        const contents = createContents();
        // The level as a number among the arguments (older Electron)...
        contents.emit('console-message', {}, 3, 'Uncaught Error: test', 1, '');
        contents.emit('console-message', {}, 1, 'just a log', 7, 'a.js');
        // ...and as a word on the event (newer).
        contents.emit('console-message', {
            level: 'warning',
            message: 'slow\n   frame',
            lineNumber: 42,
            sourceId: 'https://localhost:3000/src/screen/ScreenComp.tsx?t=1',
        });
        contents.emit('console-message', { level: 'info', message: 'hello' });
        expect(getRecentConsoleLines(contents as any)).toEqual([
            'error: Uncaught Error: test',
            'warning: slow frame (ScreenComp.tsx:42)',
        ]);
    });

    // An address names where the app is installed, and so whose computer.
    it('names a line by its file and never by the whole address', () => {
        expect(
            toConsoleLine(
                3,
                'boom',
                10,
                'file:///C:/Users/sokha/AppData/Local/Programs/app/resources/app.asar/dist/presenter.js',
            ),
        ).toBe('error: boom (presenter.js:10)');
        expect(toConsoleLine('error', 'boom', 0, 'C:\\a\\b\\main.js')).toBe(
            'error: boom (main.js)',
        );
        expect(toConsoleLine(3, '   ')).toBeNull();
        expect(toConsoleLine(0, 'verbose')).toBeNull();
        // Electron's banner about a development window is not an error.
        expect(
            toConsoleLine(
                2,
                '%cElectron Security Warning (Disabled webSecurity) font-weight: bold; This renderer process has "webSecurity" disabled.',
            ),
        ).toBeNull();
        expect(toConsoleLine(3, 'x'.repeat(900))!.length).toBeLessThan(520);
    });

    // Memory held for the life of a window, on a machine with none to spare.
    it('holds forty lines a window, one for a line said over and over, and lets go with the window', () => {
        const contents = createContents();
        for (let index = 0; index < 5; index++) {
            contents.emit('console-message', {}, 3, 'the same every frame');
        }
        expect(getRecentConsoleLines(contents as any)).toHaveLength(1);
        // Said again later, between others: still one line, and at the end.
        contents.emit('console-message', {}, 2, 'another');
        contents.emit('console-message', {}, 3, 'the same every frame');
        expect(getRecentConsoleLines(contents as any)).toEqual([
            'warning: another',
            'error: the same every frame',
        ]);
        for (let index = 0; index < 60; index++) {
            contents.emit('console-message', {}, 3, `error ${index}`);
        }
        const lines = getRecentConsoleLines(contents as any);
        expect(lines).toHaveLength(40);
        expect(lines[0]).toBe('error: error 20');
        expect(lines[39]).toBe('error: error 59');
        // What is handed out is a copy.
        lines.length = 0;
        expect(getRecentConsoleLines(contents as any)).toHaveLength(40);
        contents.emit('destroyed');
        expect(getRecentConsoleLines(contents as any)).toEqual([]);
    });

    it('listens to the app’s own windows only, each apart', () => {
        const guest = createContents('webview');
        guest.emit('console-message', {}, 3, 'a stranger’s page');
        expect(getRecentConsoleLines(guest as any)).toEqual([]);
        const one = createContents();
        const other = createContents();
        one.emit('console-message', {}, 3, 'in the presenter');
        expect(getRecentConsoleLines(other as any)).toEqual([]);
        expect(getRecentConsoleLines(one as any)).toEqual([
            'error: in the presenter',
        ]);
        expect(getRecentConsoleLines(null)).toEqual([]);
        expect(
            getRecentConsoleLines({ ...one, isDestroyed: () => true } as any),
        ).toEqual([]);
    });
});
