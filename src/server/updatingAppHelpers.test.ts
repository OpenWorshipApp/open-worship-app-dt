import { beforeEach, describe, expect, test, vi } from 'vitest';

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

vi.mock('./appProvider', () => ({
    default: {
        appInfo: {
            homepage: 'https://www.openworship.app',
            version: '2026.2.8',
        },
        systemUtils: {
            isWindows: false,
            isMac: true,
            isArm64: true,
            is64System: true,
            isLinux: false,
        },
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
    getDownloadPath: getDownloadPathMock,
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
});
