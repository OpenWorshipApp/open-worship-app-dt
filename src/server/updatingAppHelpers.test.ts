import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const listenForDataMock = vi.fn();
const sendDataMock = vi.fn();
const showSimpleToastMock = vi.fn();
const handleErrorMock = vi.fn();
const showAppConfirmMock = vi.fn();
const appLogMock = vi.fn();
const appErrorMock = vi.fn();
const fsMoveMock = vi.fn();
const getDownloadPathMock = vi.fn();
const pathJoinMock = vi.fn();
const initHttpRequestMock = vi.fn();
const writeStreamToFileMock = vi.fn();
const showFileOrDirExplorerMock = vi.fn();
const hideProgressBarMock = vi.fn();
const showProgressBarMock = vi.fn();
const showProgressBarMessageMock = vi.fn();
const genNextFilePathMock = vi.fn();
const getInstanceMock = vi.fn();
const getFileChecksumMock = vi.fn();
const fsDeleteFileMock = vi.fn();

// A mutable systemUtils so individual tests can drive checkIsItemMatch across
// every OS/architecture combination. checkIsItemMatch reads
// `appProvider.systemUtils` at call time, so mutating these fields in place
// (never reassigning the object) is observed by the module under test.
const { systemUtilsMock, defaultSystemUtils } = vi.hoisted(() => {
    const defaultSystemUtils = {
        isWindows: false,
        isMac: true,
        isArm64: true,
        is64System: true,
        isLinux: false,
        isUbuntu: false,
        isFedora: false,
    };
    return {
        defaultSystemUtils,
        systemUtilsMock: { ...defaultSystemUtils },
    };
});

vi.mock('./appProvider', () => ({
    default: {
        appInfo: {
            homepage: 'https://www.openworship.app',
            version: '2026.2.8',
        },
        systemUtils: systemUtilsMock,
        messageUtils: {
            listenForData: listenForDataMock,
            sendData: sendDataMock,
        },
    },
}));

vi.mock('../toast/toastHelpers', () => ({
    showSimpleToast: showSimpleToastMock,
}));

vi.mock('../helper/errorHelpers', () => ({
    handleError: handleErrorMock,
}));

vi.mock('../popup-widget/popupWidgetHelpers', () => ({
    showAppConfirm: showAppConfirmMock,
}));

vi.mock('../helper/loggerHelpers', () => ({
    appLog: appLogMock,
    appError: appErrorMock,
}));

vi.mock('../lang/langHelpers', () => ({
    tran: (text: string) => text,
}));

vi.mock('./fileHelpers', () => ({
    fsMove: fsMoveMock,
    fsDeleteFile: fsDeleteFileMock,
    getDownloadPath: getDownloadPathMock,
    getFileChecksum: getFileChecksumMock,
    pathJoin: pathJoinMock,
}));

vi.mock('../helper/bible-helpers/downloadHelpers', () => ({
    initHttpRequest: initHttpRequestMock,
    writeStreamToFile: writeStreamToFileMock,
}));

vi.mock('./appHelpers', () => ({
    showFileOrDirExplorer: showFileOrDirExplorerMock,
}));

vi.mock('../progress-bar/progressBarHelpers', () => ({
    hideProgressBar: hideProgressBarMock,
    showProgressBar: showProgressBarMock,
    showProgressBarMessage: showProgressBarMessageMock,
}));

vi.mock('../helper/FileSource', () => ({
    default: {
        getInstance: getInstanceMock,
    },
}));

vi.mock('../helper/timeoutHelpers', () => ({
    genTimeoutAttempt: () => {
        return (fn: () => void) => fn();
    },
}));

describe('updatingAppHelpers', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        // Restore the default (mac + arm64) environment before each test.
        Object.assign(systemUtilsMock, defaultSystemUtils);
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2026-02-09T00:00:00Z'));

        Object.defineProperty(globalThis, 'addEventListener', {
            value: vi.fn(),
            configurable: true,
        });
        Object.defineProperty(globalThis, 'removeEventListener', {
            value: vi.fn(),
            configurable: true,
        });

        Object.defineProperty(globalThis, 'crypto', {
            value: {
                randomUUID: vi.fn(() => 'uuid'),
            },
            configurable: true,
        });

        getDownloadPathMock.mockReturnValue('/downloads');
        pathJoinMock.mockImplementation((...parts: string[]) =>
            parts.join('/'),
        );
        getInstanceMock.mockReturnValue({
            genNextFilePath: genNextFilePathMock,
        });
        genNextFilePathMock.mockResolvedValue('/downloads/update-final.dmg');
        fsMoveMock.mockResolvedValue(undefined);
        fsDeleteFileMock.mockResolvedValue(undefined);
        // The download mocks use 'sum' as the installer checksum, so a matching
        // file checksum represents a healthy (non-corrupt) download.
        getFileChecksumMock.mockResolvedValue('sum');
        initHttpRequestMock.mockResolvedValue({ statusCode: 200 });
        writeStreamToFileMock.mockImplementation(
            async (
                _filePath: string,
                options: { onDone: (error: Error | null) => void },
            ) => {
                options.onDone(null);
            },
        );

        let fetchCall = 0;
        globalThis.fetch = vi.fn(async () => {
            fetchCall += 1;
            if (fetchCall === 1) {
                return {
                    ok: true,
                    json: async () => ({
                        macArm64: {
                            isWindows: false,
                            isMac: true,
                            isArm64: true,
                            isLinux: false,
                        },
                    }),
                } as Response;
            }
            return {
                ok: true,
                json: async () => ({
                    version: '2026.2.9',
                    commitID: 'abc',
                    isMac: true,
                    isArm64: true,
                    isUniversal: false,
                    portable: [
                        {
                            fileFullName: 'update.zip',
                            checksum: 'sum',
                            publicPath: 'path',
                            releaseDate: '2026-01-01',
                        },
                    ],
                    installer: [
                        {
                            fileFullName: 'update.dmg',
                            checksum: 'sum',
                            publicPath: 'download/update.dmg',
                            releaseDate: '2026-01-01',
                        },
                    ],
                }),
            } as Response;
        }) as any;
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    test('registers update-check message listener on module load', async () => {
        await import('./updatingAppHelpers');

        expect(listenForDataMock).toHaveBeenCalledTimes(1);
        expect(listenForDataMock).toHaveBeenCalledWith(
            'main:app:check-update',
            expect.any(Function),
        );
    });

    test('downloads update and opens file explorer when user confirms', async () => {
        showAppConfirmMock
            .mockResolvedValueOnce(true)
            .mockResolvedValueOnce(true);

        const { checkForAppUpdate } = await import('./updatingAppHelpers');
        await checkForAppUpdate(false);

        expect(showProgressBarMock).toHaveBeenCalledWith('app-update-download');
        expect(showProgressBarMessageMock).toHaveBeenCalledWith(
            'Downloading file...',
        );
        expect(fsMoveMock).toHaveBeenCalledWith(
            '/downloads/update.dmg.uuid.owa-downloading',
            '/downloads/update-final.dmg',
        );
        expect(showFileOrDirExplorerMock).toHaveBeenCalledWith(
            '/downloads/update-final.dmg',
        );
        expect(hideProgressBarMock).toHaveBeenCalledWith('app-update-download');
    });

    test('reports failure and does not open explorer on checksum mismatch', async () => {
        showAppConfirmMock.mockResolvedValueOnce(true); // confirm download
        getFileChecksumMock.mockResolvedValueOnce('a-different-hash');

        const { checkForAppUpdate } = await import('./updatingAppHelpers');
        await checkForAppUpdate(false);

        // The corrupt file must be deleted, an error surfaced, and the update
        // must NOT be presented as a successful download.
        expect(fsDeleteFileMock).toHaveBeenCalledWith(
            '/downloads/update.dmg.uuid.owa-downloading',
        );
        expect(fsMoveMock).not.toHaveBeenCalled();
        expect(showFileOrDirExplorerMock).not.toHaveBeenCalled();
        expect(showSimpleToastMock).toHaveBeenCalledWith(
            'Error occurred during download',
            expect.stringContaining('corrupted'),
        );
    });

    test('shows no-update toast when version is current and check is not silent', async () => {
        globalThis.fetch = vi
            .fn()
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    macArm64: {
                        isWindows: false,
                        isMac: true,
                        isArm64: true,
                        isLinux: false,
                    },
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    version: '2026.2.8',
                    commitID: 'abc',
                    isMac: true,
                    isArm64: true,
                    isUniversal: false,
                    portable: [
                        {
                            fileFullName: 'update.zip',
                            checksum: 'sum',
                            publicPath: 'path',
                            releaseDate: '2026-01-01',
                        },
                    ],
                    installer: [
                        {
                            fileFullName: 'update.dmg',
                            checksum: 'sum',
                            publicPath: 'download/update.dmg',
                            releaseDate: '2026-01-01',
                        },
                    ],
                }),
            }) as any;

        const { checkForAppUpdate } = await import('./updatingAppHelpers');
        await checkForAppUpdate(false);

        expect(showSimpleToastMock).toHaveBeenCalledWith(
            'No Update Needed',
            'You are using the latest version of the app.',
        );
        expect(showAppConfirmMock).not.toHaveBeenCalled();
    });

    describe('checkIsItemMatch', () => {
        type SystemUtilsShape = typeof defaultSystemUtils;
        type ItemShape = {
            isArm64?: boolean;
            is64System?: boolean;
            isWindows?: boolean;
            isMac?: boolean;
            isUniversal?: boolean;
            isLinux?: boolean;
            isUbuntu?: boolean;
            isFedora?: boolean;
        };

        const allFalse: SystemUtilsShape = {
            isWindows: false,
            isMac: false,
            isLinux: false,
            isArm64: false,
            is64System: false,
            isUbuntu: false,
            isFedora: false,
        };

        async function matches(
            sys: Partial<SystemUtilsShape>,
            item: ItemShape,
        ) {
            Object.assign(systemUtilsMock, allFalse, sys);
            const { checkIsItemMatch } = await import('./updatingAppHelpers');
            return checkIsItemMatch(item as any);
        }

        // name, system, item, expected
        const cases: [string, Partial<SystemUtilsShape>, ItemShape, boolean][] =
            [
                // ---- Architecture gate: arch mismatch is rejected on every OS
                [
                    'arm64 machine rejects a non-arm64 windows build',
                    { isWindows: true, isArm64: true, is64System: true },
                    { isWindows: true, is64System: true },
                    false,
                ],
                [
                    'x64 machine rejects an arm64 windows build (reverse guard)',
                    { isWindows: true, is64System: true },
                    { isWindows: true, isArm64: true, is64System: true },
                    false,
                ],
                [
                    'arm64 machine rejects a non-arm64 mac build',
                    { isMac: true, isArm64: true },
                    { isMac: true },
                    false,
                ],
                [
                    'x64 machine rejects an arm64 mac build (reverse guard)',
                    { isMac: true },
                    { isMac: true, isArm64: true },
                    false,
                ],
                [
                    'arm64 machine rejects a non-arm64 linux build',
                    { isLinux: true, isArm64: true },
                    { isLinux: true },
                    false,
                ],
                [
                    'x64 machine rejects an arm64 linux build (reverse guard)',
                    { isLinux: true },
                    { isLinux: true, isArm64: true },
                    false,
                ],

                // ---- Windows
                [
                    'x64 windows machine matches a 64-bit windows build',
                    { isWindows: true, is64System: true },
                    { isWindows: true, is64System: true },
                    true,
                ],
                [
                    'arm64 windows machine matches an arm64 windows build',
                    { isWindows: true, isArm64: true, is64System: true },
                    { isWindows: true, isArm64: true, is64System: true },
                    true,
                ],
                [
                    'windows machine rejects a non-windows build',
                    { isWindows: true, is64System: true },
                    { isMac: true },
                    false,
                ],
                [
                    'x64 windows machine rejects a 32-bit-only build',
                    { isWindows: true, is64System: true },
                    { isWindows: true },
                    false,
                ],
                [
                    '32-bit windows machine matches a 32-bit windows build',
                    { isWindows: true, is64System: false },
                    { isWindows: true },
                    true,
                ],

                // ---- Mac
                [
                    'x64 mac machine matches an x64 mac build',
                    { isMac: true },
                    { isMac: true },
                    true,
                ],
                [
                    'arm64 mac machine matches an arm64 mac build',
                    { isMac: true, isArm64: true },
                    { isMac: true, isArm64: true },
                    true,
                ],
                [
                    'mac machine rejects a windows build',
                    { isMac: true },
                    { isWindows: true, is64System: true },
                    false,
                ],
                // Documents a known gap: a universal build (no isArm64 flag) is
                // rejected on arm64 macs by the top arch gate, yet accepted on
                // x64 macs. See the isUniversal note in updatingAppHelpers.tsx.
                [
                    'arm64 mac machine rejects a universal build lacking isArm64',
                    { isMac: true, isArm64: true },
                    { isMac: true, isUniversal: true },
                    false,
                ],
                [
                    'x64 mac machine accepts a universal build lacking isArm64',
                    { isMac: true },
                    { isMac: true, isUniversal: true },
                    true,
                ],

                // ---- Linux (generic / ubuntu / fedora)
                [
                    'generic linux machine matches a plain linux build',
                    { isLinux: true },
                    { isLinux: true },
                    true,
                ],
                [
                    'linux machine rejects a non-linux build',
                    { isLinux: true },
                    { isMac: true },
                    false,
                ],
                [
                    'ubuntu machine rejects a non-ubuntu linux build',
                    { isLinux: true, isUbuntu: true },
                    { isLinux: true },
                    false,
                ],
                [
                    'ubuntu machine matches an ubuntu build',
                    { isLinux: true, isUbuntu: true },
                    { isLinux: true, isUbuntu: true },
                    true,
                ],
                [
                    'fedora machine rejects a non-fedora linux build',
                    { isLinux: true, isFedora: true },
                    { isLinux: true },
                    false,
                ],
                [
                    'fedora machine matches a fedora build',
                    { isLinux: true, isFedora: true },
                    { isLinux: true, isFedora: true },
                    true,
                ],
                [
                    'arm64 ubuntu machine matches an arm64 ubuntu build',
                    { isLinux: true, isUbuntu: true, isArm64: true },
                    { isLinux: true, isUbuntu: true, isArm64: true },
                    true,
                ],

                // ---- No/unknown platform falls through to false
                [
                    'machine with no OS flag matches nothing',
                    {},
                    { isWindows: true, isMac: true, isLinux: true },
                    false,
                ],
                [
                    'machine with no OS flag rejects an empty item',
                    {},
                    {},
                    false,
                ],
            ];

        test.each(cases)('%s', async (_name, sys, item, expected) => {
            await expect(matches(sys, item)).resolves.toBe(expected);
        });
    });
});
