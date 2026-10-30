import { EventEmitter } from 'node:events';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { APP_WINDOWS_CHANGED_CHANNEL as RENDERER_CHANGED_CHANNEL } from '../src/chatbot/windowAimHelpers';
import { BOT_FOCUS_LIST } from '../tools/owa-devtools-mcp/botFocus.mjs';

const { appMock, openWindowList } = vi.hoisted(() => {
    return { appMock: { on: vi.fn() }, openWindowList: [] as unknown[] };
});
vi.mock('electron', () => ({
    app: appMock,
    BrowserWindow: { getAllWindows: () => openWindowList },
}));

import {
    APP_WINDOWS_CHANGED_CHANNEL,
    checkIsWatchedPageUrl,
    initAppWindowListWatch,
    listAppWindows,
    WATCHED_PAGE_LIST,
} from './appWindowListHelpers';

function genFetch(body: unknown, ok = true) {
    return vi.fn(async () => {
        return { ok, json: async () => body } as Response;
    });
}

describe('listAppWindows', () => {
    it('lists the app pages by id, title and address, and nothing else', async () => {
        const fetchUrl = genFetch([
            {
                type: 'page',
                id: 'MAIN',
                title: 'Open Worship app - Presenter',
                url: 'https://localhost:3000/presenter.html',
            },
            {
                type: 'page',
                id: 'READER',
                title: 'Open Worship app - Reader',
                url: 'https://localhost:3000/reader.html?uuid=reader',
            },
            { type: 'page', id: 'TOOLS', url: 'devtools://devtools/x' },
            { type: 'service_worker', id: 'SW', url: 'https://x/sw.js' },
            { type: 'page', url: 'https://localhost:3000/no-id.html' },
        ]);
        expect(await listAppWindows(9222, fetchUrl as any)).toEqual([
            {
                id: 'MAIN',
                title: 'Open Worship app - Presenter',
                url: 'https://localhost:3000/presenter.html',
            },
            {
                id: 'READER',
                title: 'Open Worship app - Reader',
                url: 'https://localhost:3000/reader.html?uuid=reader',
            },
        ]);
        expect(fetchUrl).toHaveBeenCalledWith(
            'http://127.0.0.1:9222/json/list',
            expect.objectContaining({ signal: expect.anything() }),
        );
    });

    // No endpoint, or none answering: no picker, never a thrown error.
    it('answers an empty list when there is nothing to ask or it fails', async () => {
        const fetchUrl = genFetch([]);
        expect(await listAppWindows(null, fetchUrl as any)).toEqual([]);
        expect(fetchUrl).not.toHaveBeenCalled();
        expect(await listAppWindows(1, genFetch({}, false) as any)).toEqual([]);
        expect(
            await listAppWindows(1, genFetch({ not: 'a list' }) as any),
        ).toEqual([]);
        const failing = vi.fn(async () => {
            throw new Error('refused');
        });
        expect(await listAppWindows(1, failing as any)).toEqual([]);
    });
});

const HOST = 'https://localhost:3000';

type FakeWindowType = EventEmitter & {
    webContents: EventEmitter & { getURL: () => string; send: any };
    isDestroyed: () => boolean;
};

function genWindow(url: string): FakeWindowType {
    const webContents = Object.assign(new EventEmitter(), {
        getURL: () => url,
        send: vi.fn(),
    });
    return Object.assign(new EventEmitter(), {
        webContents,
        isDestroyed: () => false,
    });
}

// The user, Settings opened while the help was up and not in its list:
// _it should real-time tracking the new opening_.
describe('initAppWindowListWatch', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    function startWatch(windowList: FakeWindowType[]) {
        vi.useFakeTimers();
        initAppWindowListWatch(() => windowList as any);
        const [eventName, onCreated] = appMock.on.mock.calls.at(-1) as any;
        expect(eventName).toBe('browser-window-created');
        return (win: FakeWindowType) => {
            onCreated({}, win);
        };
    }

    it('tells the help window once per burst when a window opens, retitles or closes', () => {
        const help = genWindow(`${HOST}/chatbot.html?uuid=chatbot`);
        const setting = genWindow(`${HOST}/setting.html?uuid=setting`);
        const created = startWatch([help, setting]);
        created(setting);
        setting.webContents.emit('did-finish-load');
        setting.webContents.emit('page-title-updated');
        vi.advanceTimersByTime(299);
        expect(help.webContents.send).not.toHaveBeenCalled();
        vi.advanceTimersByTime(1);
        expect(help.webContents.send).toHaveBeenCalledTimes(1);
        expect(help.webContents.send).toHaveBeenCalledWith(
            APP_WINDOWS_CHANGED_CHANNEL,
        );
        // Only the help window is told.
        expect(setting.webContents.send).not.toHaveBeenCalled();

        setting.emit('closed');
        vi.advanceTimersByTime(300);
        expect(help.webContents.send).toHaveBeenCalledTimes(2);
    });

    // A quiet app costs nothing: a print or web-read window is no news,
    // and with no help window open nobody is told.
    it('is quiet about windows the picker never lists', () => {
        const help = genWindow(`${HOST}/chatbot.html?uuid=chatbot`);
        const print = genWindow('file:///tmp/print-preview-1-2.html');
        const created = startWatch([help, print]);
        created(print);
        print.webContents.emit('did-finish-load');
        print.webContents.emit('page-title-updated');
        print.emit('closed');
        vi.advanceTimersByTime(1000);
        expect(help.webContents.send).not.toHaveBeenCalled();
    });

    // The help window listens on the name main sends on.
    it('speaks on the channel the help window listens to', () => {
        expect(APP_WINDOWS_CHANGED_CHANNEL).toBe(RENDERER_CHANGED_CHANNEL);
    });

    it('lists exactly the windows the help is about', () => {
        expect([...WATCHED_PAGE_LIST].sort()).toEqual(
            BOT_FOCUS_LIST.map((item) => {
                return item.window;
            }).sort(),
        );
        expect(checkIsWatchedPageUrl(`${HOST}/reader.html?uuid=reader`)).toBe(
            true,
        );
        expect(checkIsWatchedPageUrl(`${HOST}/screen.html?screenId=1`)).toBe(
            false,
        );
        expect(checkIsWatchedPageUrl('not an address')).toBe(false);
    });

    it('finds the help windows among every open window by default', () => {
        const help = genWindow(`${HOST}/chatbot.html?uuid=chatbot`);
        const reader = genWindow(`${HOST}/reader.html?uuid=reader`);
        openWindowList.splice(0, openWindowList.length, help, reader);
        try {
            vi.useFakeTimers();
            initAppWindowListWatch();
            const [, onCreated] = appMock.on.mock.calls.at(-1) as any;
            onCreated({}, reader);
            reader.webContents.emit('did-finish-load');
            vi.advanceTimersByTime(300);
            expect(help.webContents.send).toHaveBeenCalledExactlyOnceWith(
                APP_WINDOWS_CHANGED_CHANNEL,
            );
            expect(reader.webContents.send).not.toHaveBeenCalled();
        } finally {
            openWindowList.splice(0);
        }
    });
});
