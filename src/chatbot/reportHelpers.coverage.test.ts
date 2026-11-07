import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// What a report reads of the app -- the window, the screens, the console and
// the machine -- and what Send does when Stop came first. The app is a router
// of tool answers here, and a tool nobody routed THROWS, the way a tool host
// with that tool missing answers.
const { mocks } = vi.hoisted(() => ({
    mocks: {
        appError: vi.fn(),
        sendData: vi.fn(),
        electronSendAsync: vi.fn(),
        fsWriteFileSync: vi.fn(),
        writeFileFromBase64Sync: vi.fn(),
        fsGetFileSize: vi.fn(),
        fsReadFile: vi.fn(),
        fsReadFileBase64Sync: vi.fn(),
        routes: {} as Record<string, () => any>,
    },
}));

vi.mock('../server/appProvider', () => ({
    default: {
        appInfo: {
            title: 'Open Worship app',
            version: '2026.10.1',
            homepage: 'https://www.openworship.app',
        },
        messageUtils: {
            sendData: (...args: any[]) => mocks.sendData(...args),
        },
        systemUtils: {
            isDev: true,
            isWindows: true,
            isMac: false,
            isLinux: false,
            is64System: true,
            commitHash: 'abcdef1234567890',
        },
    },
}));
vi.mock('../server/fileHelpers', async () => {
    // The real rule, from its leaf: it needs no file layer.
    const { toPathScrubbed } = await vi.importActual<
        typeof import('../server/accountPathHelpers')
    >('../server/accountPathHelpers');
    return {
        toPathScrubbed,
        fsGetFileSize: (...args: any[]) => mocks.fsGetFileSize(...args),
        fsReadFile: (...args: any[]) => mocks.fsReadFile(...args),
        fsReadFileBase64Sync: (...args: any[]) =>
            mocks.fsReadFileBase64Sync(...args),
        fsWriteFileSync: (...args: any[]) => mocks.fsWriteFileSync(...args),
        getDownloadPath: () => '/downloads',
        pathJoin: (...parts: string[]) => parts.join('/'),
        writeFileFromBase64Sync: (...args: any[]) =>
            mocks.writeFileFromBase64Sync(...args),
    };
});
vi.mock('../server/electronSendHelpers', () => ({
    electronSendAsync: (...args: any[]) => mocks.electronSendAsync(...args),
}));
vi.mock('../helper/loggerHelpers', () => ({
    appError: (...args: any[]) => mocks.appError(...args),
}));
vi.mock('./mcpClient', () => ({
    callTool: async (name: string) => {
        const route = mocks.routes[name];
        if (route === undefined) {
            throw new Error(`no tool ${name}`);
        }
        return route();
    },
    parseToolJson: (text: any) => {
        return typeof text === 'string' && text.length > 0
            ? JSON.parse(text)
            : null;
    },
}));

import {
    collectReportEvidence,
    gatherReportFiles,
    genPreparedReport,
    postIssueReport,
} from './reportHelpers';

const ELECTRON_USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, ' +
    'like Gecko) open-worship-app/2026.10.1 Chrome/142.0.7444.59 ' +
    'Electron/39.2.0 Safari/537.36';

const EVIDENCE = {
    collectedAt: '2026-10-01T09:00:00.000Z',
    appLine: 'Open Worship app 2026.10.1 on Windows x64 (dev build)',
    machineLine: 'Machine: Windows NT 10.0; Win64; x64',
    windowLine: 'Window: Presenter (presenter.html), language en, theme dark',
    selectionLines: [],
    screenLine: 'Screens: none showing, 1 display(s) attached',
    screenLines: [],
    displayLines: [],
    consoleLines: [],
    turns: [{ author: 'you' as const, text: 'the screen went blank' }],
};

function routeJson(name: string, value: unknown) {
    mocks.routes[name] = () => JSON.stringify(value);
}

beforeEach(() => {
    mocks.routes = {};
    mocks.appError.mockImplementation(() => {});
    mocks.sendData.mockImplementation(() => {});
    mocks.electronSendAsync.mockResolvedValue([]);
    mocks.fsWriteFileSync.mockImplementation(() => {});
    mocks.writeFileFromBase64Sync.mockImplementation(() => {});
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
});

describe('what a report says of the machine', () => {
    test('the OS, the Electron and Chromium builds, the locale and the display scale', async () => {
        vi.stubGlobal('navigator', {
            userAgent: ELECTRON_USER_AGENT,
            language: 'km-KH',
        });
        // The fact behind most "too small" reports.
        vi.stubGlobal('window', { devicePixelRatio: 1.25 });
        const { machineLine } = await collectReportEvidence([]);
        expect(
            machineLine.startsWith(
                'Machine: Windows NT 10.0; Win64; x64, Electron 39.2.0, ' +
                    'Chromium 142.0.7444.59, locale km-KH',
            ),
        ).toBe(true);
        expect(machineLine.endsWith(', display scale 1.25x')).toBe(true);
    });

    test('a window with no navigator says so, and still reports', async () => {
        vi.stubGlobal('navigator', undefined);
        const evidence = await collectReportEvidence([]);
        expect(evidence.machineLine).toBe('Machine: could not be read');
        expect(evidence.appLine).toBe(
            'Open Worship app 2026.10.1 on Windows x64 (dev build, commit ' +
                'abcdef12)',
        );
    });
});

describe('what a report says of the window', () => {
    test('its title, page, language, theme and active tabs, and what is selected', async () => {
        routeJson('owa_app_state', {
            mainWindow: {
                title: 'Open Worship',
                page: 'presenter.html',
                language: 'km',
                theme: 'dark',
                tabs: [
                    { label: 'Documents', isActive: true },
                    { label: 'Bible', isActive: false },
                    // Not a label: left out, never "undefined".
                    { label: 42, isActive: true },
                    { label: 'Lyrics', isActive: true },
                ],
                selectedDocument: {
                    name: 'Amazing Grace',
                    kind: 'song',
                    slideCount: 3,
                    slides: [],
                    onScreen: null,
                    next: null,
                    previous: null,
                },
                runSheet: {
                    openSheets: [],
                    availableSheets: ['Sunday'],
                },
                // Never copied: it names the account.
                instances: [{ dataDir: 'C:/Users/sokha/Documents' }],
            },
        });
        const evidence = await collectReportEvidence([]);
        expect(evidence.windowLine).toBe(
            'Window: Open Worship (presenter.html), language km, theme ' +
                'dark, active tabs: Documents / Lyrics',
        );
        expect(evidence.selectionLines).toHaveLength(2);
        expect(evidence.selectionLines[0]).toContain(
            'The song "Amazing Grace" is selected (3 slides).',
        );
        expect(evidence.selectionLines[1]).toContain('No run sheet is open');
        expect(JSON.stringify(evidence)).not.toContain('sokha');
    });

    test('a state with no main window is said to be unreadable, with nothing selected', async () => {
        routeJson('owa_app_state', { windows: [] });
        const evidence = await collectReportEvidence([]);
        expect(evidence.windowLine).toBe('Window: could not be read');
        expect(evidence.selectionLines).toEqual([]);
    });

    test('off the Presenter there is no selection to report, and no line for it', async () => {
        routeJson('owa_app_state', {
            mainWindow: { title: 'Open Worship', page: 'reader.html' },
        });
        const evidence = await collectReportEvidence([]);
        expect(evidence.windowLine).toBe(
            'Window: Open Worship (reader.html), language unknown, theme ' +
                'unknown',
        );
        expect(evidence.selectionLines).toEqual([]);
    });
});

describe('what a report says of the screens', () => {
    test('one line a screen: showing or hidden, locked, its display and what it holds', async () => {
        routeJson('owa_list_screens', {
            showingScreenIds: [1],
            displays: [
                {
                    id: 7,
                    label: 'TV',
                    width: 1920,
                    height: 1080,
                    isPrimary: true,
                },
            ],
            screens: [
                {
                    screenId: 1,
                    isShowing: true,
                    isLocked: true,
                    display: { id: 7 },
                    bible: { reference: 'John 3:16', version: 'KJV' },
                },
                { screenId: 2, isShowing: false },
                // An entry the tool could not describe at all.
                null,
            ],
        });
        const evidence = await collectReportEvidence([]);
        expect(evidence.screenLine).toBe(
            'Screens: 1 showing, 1 display(s) attached',
        );
        expect(evidence.screenLines).toEqual([
            'Screen 1 (showing, locked, on display 7): John 3:16 (KJV)',
            'Screen 2 (hidden): nothing on any layer',
            'Screen ? (hidden): nothing known',
        ]);
        expect(evidence.displayLines).toEqual([
            'Display 7 "TV": 1920×1080, primary',
        ]);
    });
});

describe('what a report says of the console', () => {
    test('a main process that never answers costs the console, not the report', async () => {
        vi.useFakeTimers();
        mocks.electronSendAsync.mockImplementation(() => {
            return new Promise(() => {});
        });
        const pending = collectReportEvidence([]);
        await vi.advanceTimersByTimeAsync(3000);
        const evidence = await pending;
        expect(evidence.consoleLines).toEqual([]);
        expect(mocks.electronSendAsync).toHaveBeenCalledWith(
            'main:app:recent-console',
            {},
        );
    });

    test('a console that cannot be read is no lines, never a lost report', async () => {
        mocks.electronSendAsync.mockRejectedValue(new Error('no handler'));
        const evidence = await collectReportEvidence([
            { author: 'you', text: 'it froze' },
        ]);
        expect(evidence.consoleLines).toEqual([]);
        expect(evidence.turns).toEqual([{ author: 'you', text: 'it froze' }]);
    });
});

describe('the files a report takes', () => {
    // Defensive: every attachment a report holds was checked field by field
    // when its tab loaded, so this is a description no session can carry --
    // and the one way left to break the read. The promise is "never throws".
    test('one whose description cannot be read is noted, and the rest still go', async () => {
        const gathered = await gatherReportFiles({
            reference: 'OWA-1',
            imageDataUrl: 'data:image/png;base64,AAAA',
            attachments: [
                {
                    id: 'a1',
                    kind: 'text',
                    name: 'notes.txt',
                    mimeType: 'text/plain',
                    byteSize: 5,
                    summary: 42,
                },
            ],
        } as any);
        expect(gathered.files).toEqual([
            { name: 'OWA-1.png', mimeType: 'image/png', data: 'AAAA' },
        ]);
        expect(gathered.notes.map((note) => [note.name, note.why])).toEqual([
            ['OWA-1.png', undefined],
            ['notes.txt', 'it could not be read'],
        ]);
        expect(mocks.appError).toHaveBeenCalledWith(expect.any(TypeError));
    });
});

describe('Send after Stop', () => {
    test('a Stop pressed first tells main at once, and the report is not said to be sent', async () => {
        vi.useFakeTimers();
        // Main never answers the post itself.
        mocks.electronSendAsync.mockImplementation(() => {
            return new Promise(() => {});
        });
        const report = genPreparedReport({
            complaint: 'the screen went blank',
            answerText: 'REPORT:\nTITLE: Blank screen\n',
            evidence: EVIDENCE,
            imageDataUrl: null,
        });
        const controller = new AbortController();
        controller.abort();
        const pending = postIssueReport(report, controller.signal);
        await vi.advanceTimersByTimeAsync(2000);
        const posted = await pending;
        const [postChannel, postData] = mocks.electronSendAsync.mock.calls[0];
        expect(postChannel).toBe('main:app:llm-report-post');
        // The cancel names the very post it is for.
        expect(mocks.sendData).toHaveBeenCalledWith(
            'main:app:llm-report-post-cancel',
            { requestId: postData.requestId },
        );
        expect(posted).toMatchObject({
            reference: report.reference,
            isSent: false,
            isQueued: false,
            sendFailure: 'stopped',
            filePath: `/downloads/${report.reference}.md`,
        });
        // Saved before anything was sent, whatever the sending did.
        expect(mocks.fsWriteFileSync).toHaveBeenCalledWith(
            `/downloads/${report.reference}.md`,
            report.markdown,
        );
    });
});
