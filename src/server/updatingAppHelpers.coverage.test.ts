// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// The update check's remaining turns: a release with a full download URL, a
// newer installed version, feeds that answer with an error status, the silent
// check that runs once per window, a same-version build from another commit,
// a declined "open the file location", and a failure inside the flow. Each
// test loads the module afresh: it remembers the silent check at module level.
const h = vi.hoisted(() => {
    return {
        version: '2026.2.8',
        isDev: false,
        commitHash: undefined as string | undefined,
        listenForData: vi.fn(),
        sendData: vi.fn(),
        showSimpleToast: vi.fn(),
        handleError: vi.fn(),
        showAppConfirm: vi.fn(),
        appLog: vi.fn(),
        logError: vi.fn(),
        fsMove: vi.fn(),
        fsDeleteFile: vi.fn(),
        getFileChecksum: vi.fn(),
        initHttpRequest: vi.fn(),
        streamDownloadFile: vi.fn(),
        messageCallback: vi.fn(),
        showFileOrDirExplorer: vi.fn(),
        showProgressBar: vi.fn(),
        hideProgressBar: vi.fn(),
        genNextFilePath: vi.fn(),
    };
});

vi.mock('./appProvider', () => ({
    default: {
        appInfo: {
            homepage: 'https://www.openworship.app',
            get version() {
                return h.version;
            },
        },
        systemUtils: {
            isWindowsStore: false,
            isWindows: false,
            isMac: true,
            isArm64: true,
            is64System: true,
            isLinux: false,
            get isDev() {
                return h.isDev;
            },
            get commitHash() {
                return h.commitHash;
            },
        },
        messageUtils: {
            listenForData: (...args: unknown[]) => h.listenForData(...args),
            sendData: (...args: unknown[]) => h.sendData(...args),
        },
    },
}));
vi.mock('../toast/toastHelpers', () => ({
    showSimpleToast: h.showSimpleToast,
}));
vi.mock('../helper/errorHelpers', () => ({ handleError: h.handleError }));
vi.mock('../popup-widget/popupWidgetHelpers', () => ({
    showAppConfirm: h.showAppConfirm,
}));
vi.mock('../helper/loggerHelpers', () => ({
    appLog: h.appLog,
    appError: h.logError,
}));
vi.mock('../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('./fileHelpers', () => ({
    fsMove: h.fsMove,
    fsDeleteFile: h.fsDeleteFile,
    getDownloadPath: () => '/downloads',
    getFileChecksum: h.getFileChecksum,
    pathJoin: (...parts: string[]) => parts.join('/'),
}));
vi.mock('../helper/bible-helpers/downloadHelpers', () => ({
    initHttpRequest: h.initHttpRequest,
}));
vi.mock('../background/downloadHelper', () => ({
    messageCallback: h.messageCallback,
    streamDownloadFile: h.streamDownloadFile,
}));
vi.mock('./appHelpers', () => ({
    showFileOrDirExplorer: h.showFileOrDirExplorer,
}));
vi.mock('../progress-bar/progressBarHelpers', () => ({
    showProgressBar: h.showProgressBar,
    hideProgressBar: h.hideProgressBar,
}));
vi.mock('../helper/FileSource', () => ({
    default: {
        getInstance: () => ({ genNextFilePath: h.genNextFilePath }),
    },
}));

const PLATFORM_INFO_URL = 'https://www.openworship.app/download/info.json';
const MAC_INFO_URL = 'https://www.openworship.app/download/mac-arm64/info.json';
const FULL_INSTALLER_URL = 'https://cdn.example.test/owa/update.dmg';

function updateData(overrides: Record<string, unknown> = {}) {
    return {
        version: '2026.2.9',
        commitID: 'abcdef0123',
        isMac: true,
        isArm64: true,
        isUniversal: false,
        portable: [],
        installer: [
            {
                fileFullName: 'update.dmg',
                checksum: '',
                publicPath: FULL_INSTALLER_URL,
                releaseDate: '2026-02-09',
            },
        ],
        ...overrides,
    };
}

type FeedAnswer = { ok: boolean; statusText?: string; body?: unknown };

/** The website's two feeds: the platform index, then this platform's release. */
function stubFeeds(platformInfo: FeedAnswer, releaseInfo?: FeedAnswer) {
    const fetchMock = vi.fn(async (url: string) => {
        const answer = url === PLATFORM_INFO_URL ? platformInfo : releaseInfo;
        if (answer === undefined) {
            throw new Error(`unexpected ${url}`);
        }
        return {
            ok: answer.ok,
            statusText: answer.statusText ?? 'OK',
            json: async () => answer.body,
        };
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
}

const MAC_PLATFORMS: FeedAnswer = {
    ok: true,
    body: {
        'windows-x64': { isWindows: true, is64System: true },
        'mac-arm64': { isMac: true, isArm64: true },
    },
};

async function loadModule() {
    vi.resetModules();
    return await import('./updatingAppHelpers');
}

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-02-09T00:00:00Z'));
    vi.stubGlobal('crypto', { randomUUID: () => 'uuid-1' });
    vi.spyOn(console, 'log').mockImplementation(() => {});
    h.version = '2026.2.8';
    h.isDev = false;
    h.commitHash = undefined;
    h.initHttpRequest.mockResolvedValue({ statusCode: 200 });
    h.streamDownloadFile.mockResolvedValue(undefined);
    h.fsMove.mockResolvedValue(undefined);
    h.genNextFilePath.mockResolvedValue('/downloads/update.dmg');
});

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe('checkIsVersionOutdated', () => {
    test('a newer installed version is not outdated', async () => {
        const { checkIsVersionOutdated } = await loadModule();
        expect(checkIsVersionOutdated('2026.3.1', '2026.2.9')).toBe(false);
        expect(checkIsVersionOutdated('2026.2.9', '2026.2.10')).toBe(true);
        expect(checkIsVersionOutdated('2026.2', '2026.2.0')).toBe(false);
    });
});

describe('getDownloadTargetUrl', () => {
    test('a platform index answering with an error status finds nothing', async () => {
        stubFeeds({ ok: false, statusText: 'Not Found' });
        const { getDownloadTargetUrl } = await loadModule();

        expect(await getDownloadTargetUrl()).toBeNull();
        const [message, error] = h.logError.mock.calls[0];
        expect(message).toBe('Error fetching update download info:');
        expect(error.message).toBe(
            'Failed to fetch update download info: Not Found',
        );
        expect(h.showSimpleToast).toHaveBeenCalledExactlyOnceWith(
            'No Compatible Update Found',
            'Sorry, we could not find a compatible update for your system.',
        );
    });

    test('asked silently, the same failure shows nothing', async () => {
        stubFeeds({ ok: false, statusText: 'Not Found' });
        const { getDownloadTargetUrl } = await loadModule();
        expect(await getDownloadTargetUrl(true)).toBeNull();
        expect(h.showSimpleToast).not.toHaveBeenCalled();
    });

    test('names the release feed of the platform that matches this computer', async () => {
        stubFeeds(MAC_PLATFORMS);
        const { getDownloadTargetUrl } = await loadModule();
        expect(await getDownloadTargetUrl()).toBe(MAC_INFO_URL);
    });
});

describe('checkForAppUpdate', () => {
    test('the silent check runs once per window; asking again still checks', async () => {
        const fetchMock = stubFeeds(MAC_PLATFORMS, {
            ok: true,
            body: updateData({ version: '2026.2.8' }),
        });
        const { checkForAppUpdate } = await loadModule();

        await checkForAppUpdate();
        await checkForAppUpdate();
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(h.showSimpleToast).not.toHaveBeenCalled();

        await checkForAppUpdate(false);
        expect(fetchMock).toHaveBeenCalledTimes(4);
        expect(h.showSimpleToast).toHaveBeenCalledExactlyOnceWith(
            'No Update Needed',
            'You are using the latest version of the app.',
        );
    });

    test('a release feed answering with an error status finds nothing', async () => {
        stubFeeds(MAC_PLATFORMS, { ok: false, statusText: 'Bad Gateway' });
        const { checkForAppUpdate } = await loadModule();
        await checkForAppUpdate(false);

        const [message, error] = h.logError.mock.calls[0];
        expect(message).toBe('Error fetching update info:');
        expect(error.message).toBe('Failed to fetch update info: Bad Gateway');
        expect(h.showSimpleToast).toHaveBeenCalledExactlyOnceWith(
            'No Compatible Update Found',
            'Sorry, we could not find a compatible update for your system.',
        );
        expect(h.showAppConfirm).not.toHaveBeenCalled();
    });

    test('a packaged build of the same version from another commit is offered the update', async () => {
        h.commitHash = '9999999';
        stubFeeds(MAC_PLATFORMS, {
            ok: true,
            body: updateData({ version: '2026.2.8' }),
        });
        h.showAppConfirm.mockResolvedValue(false);
        const { checkForAppUpdate } = await loadModule();
        await checkForAppUpdate(false);

        expect(h.showAppConfirm).toHaveBeenCalledOnce();
        expect(h.showAppConfirm.mock.calls[0][1]).toContain(
            'version:"2026.2.8" and commit ID:"abcdef0"',
        );
    });

    test('the same version from the same commit needs no update', async () => {
        h.commitHash = 'abcdef0123';
        stubFeeds(MAC_PLATFORMS, {
            ok: true,
            body: updateData({ version: '2026.2.8' }),
        });
        const { checkForAppUpdate } = await loadModule();
        await checkForAppUpdate(false);
        expect(h.showAppConfirm).not.toHaveBeenCalled();
        expect(h.showSimpleToast).toHaveBeenCalledWith(
            'No Update Needed',
            'You are using the latest version of the app.',
        );
    });

    test('a dev build ignores the commit and compares versions only', async () => {
        h.isDev = true;
        h.commitHash = '9999999';
        stubFeeds(MAC_PLATFORMS, {
            ok: true,
            body: updateData({ version: '2026.2.8' }),
        });
        const { checkForAppUpdate } = await loadModule();
        await checkForAppUpdate(false);
        expect(h.showAppConfirm).not.toHaveBeenCalled();
    });

    test('downloads from a full release URL and leaves the folder closed when declined', async () => {
        stubFeeds(MAC_PLATFORMS, { ok: true, body: updateData() });
        h.showAppConfirm
            .mockResolvedValueOnce(true)
            .mockResolvedValueOnce(false);
        const { checkForAppUpdate } = await loadModule();
        await checkForAppUpdate(false);

        // A full URL is used as it is, not put under the homepage.
        const [requestUrl] = h.initHttpRequest.mock.calls[0];
        expect(String(requestUrl)).toBe(FULL_INSTALLER_URL);
        expect(h.fsMove).toHaveBeenCalledExactlyOnceWith(
            '/downloads/update.dmg.uuid-1.owa-downloading',
            '/downloads/update.dmg',
        );
        expect(h.showAppConfirm).toHaveBeenCalledTimes(2);
        expect(h.showAppConfirm.mock.calls[1][0]).toBe('Download Completed');
        expect(h.showFileOrDirExplorer).not.toHaveBeenCalled();
    });

    test('a failure inside the update flow is reported', async () => {
        stubFeeds(MAC_PLATFORMS, { ok: true, body: updateData() });
        const error = new Error('the dialog could not open');
        h.showAppConfirm.mockRejectedValue(error);
        const { checkForAppUpdate } = await loadModule();
        await checkForAppUpdate(false);
        expect(h.handleError).toHaveBeenCalledExactlyOnceWith(error);
        expect(h.initHttpRequest).not.toHaveBeenCalled();
    });
});
