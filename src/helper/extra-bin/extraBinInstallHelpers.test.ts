import { beforeEach, describe, expect, test, vi } from 'vitest';

const {
    appProviderMock,
    tarExtractMock,
    fsCloneFileMock,
    fsDeleteFileMock,
    fsListFilesMock,
    fsReadFileMock,
    ensureDirectoryMock,
    getFileChecksumMock,
    streamDownloadFileMock,
    initHttpRequestMock,
    getDownloadTargetUrlMock,
    checkIsExtraBinInstalledMock,
    getInstalledExtraBinVersionMock,
    showSimpleToastMock,
} = vi.hoisted(() => ({
    appProviderMock: {
        systemUtils: { isDev: false },
        appInfo: { version: '2026.07.26' },
        messageUtils: { sendDataSync: vi.fn(() => '/repo') },
    },
    tarExtractMock: vi.fn(),
    fsCloneFileMock: vi.fn(),
    fsDeleteFileMock: vi.fn(),
    fsListFilesMock: vi.fn(),
    fsReadFileMock: vi.fn(),
    ensureDirectoryMock: vi.fn(),
    getFileChecksumMock: vi.fn(),
    streamDownloadFileMock: vi.fn(),
    initHttpRequestMock: vi.fn(),
    getDownloadTargetUrlMock: vi.fn(),
    checkIsExtraBinInstalledMock: vi.fn(),
    getInstalledExtraBinVersionMock: vi.fn(),
    showSimpleToastMock: vi.fn(),
}));

vi.mock('../../server/appProvider', () => ({ default: appProviderMock }));

vi.mock('../../lang/langHelpers', () => ({ tran: (text: string) => text }));

vi.mock('../../toast/toastHelpers', () => ({
    showSimpleToast: showSimpleToastMock,
}));

vi.mock('../loggerHelpers', () => ({ appError: vi.fn() }));

vi.mock('../../progress-bar/progressBarHelpers', () => ({
    showProgressBar: vi.fn(),
    hideProgressBar: vi.fn(),
}));

vi.mock('../../background/downloadHelper', () => ({
    messageCallback: vi.fn(),
    streamDownloadFile: streamDownloadFileMock,
}));

vi.mock('../bible-helpers/downloadHelpers', () => ({
    initHttpRequest: initHttpRequestMock,
}));

vi.mock('../../server/appHelpers', () => ({ tarExtract: tarExtractMock }));

vi.mock('../../server/unlockingHelpers', () => ({
    unlocking: (_key: string, callback: () => any) => callback(),
}));

vi.mock('../../server/fileHelpers', () => ({
    ensureDirectory: ensureDirectoryMock,
    fsCloneFile: fsCloneFileMock,
    fsDeleteFile: fsDeleteFileMock,
    fsListFiles: fsListFilesMock,
    fsReadFile: fsReadFileMock,
    getFileChecksum: getFileChecksumMock,
    pathBasename: (filePath: string) => filePath.split('/').pop(),
    pathJoin: (...parts: string[]) => parts.join('/'),
}));

vi.mock('../../server/updatingAppHelpers', () => ({
    getDownloadTargetUrl: getDownloadTargetUrlMock,
    checkIsVersionOutdated: (current: string, latest: string) => {
        const currentParts = current.split('.').map(Number);
        const latestParts = latest.split('.').map(Number);
        for (let i = 0; i < 3; i++) {
            if ((currentParts[i] ?? 0) < (latestParts[i] ?? 0)) {
                return true;
            }
            if ((currentParts[i] ?? 0) > (latestParts[i] ?? 0)) {
                return false;
            }
        }
        return false;
    },
}));

vi.mock('./extraBinHelpers', () => ({
    EXTRA_BIN_ARCHIVE_REGEX: /^bin-.+\.tar\.gz$/,
    checkIsExtraBinInstalled: checkIsExtraBinInstalledMock,
    getExtraBinDirPath: () => '/data/extra-bin',
    getInstalledExtraBinVersion: getInstalledExtraBinVersionMock,
}));

function stubExtraBinInfo(extraBin: any) {
    getDownloadTargetUrlMock.mockResolvedValue(
        'https://host/download/win-arm64/info.json',
    );
    vi.stubGlobal(
        'fetch',
        vi.fn(async () => ({
            ok: true,
            json: async () => ({ version: '2026.07.26', extraBin }),
        })),
    );
}

async function loadModule() {
    vi.resetModules();
    return await import('./extraBinInstallHelpers');
}

describe('extraBinInstallHelpers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.unstubAllGlobals();
        appProviderMock.systemUtils.isDev = false;
        appProviderMock.appInfo.version = '2026.07.26';
        fsListFilesMock.mockResolvedValue([]);
        checkIsExtraBinInstalledMock.mockResolvedValue({
            isInstalled: true,
            missingNames: [],
        });
        getInstalledExtraBinVersionMock.mockResolvedValue('0.0.1');
    });

    test('takes the entry published for this exact app version', async () => {
        const module = await loadModule();
        stubExtraBinInfo({
            '2026.07.19': {
                url: 'https://host/bin-0.0.1.tar.gz',
                version: '0.0.1',
            },
            '2026.07.26': {
                url: 'https://host/bin-0.0.2.tar.gz',
                version: '0.0.2',
            },
        });

        expect(await module.getExtraBinEntry()).toEqual({
            url: 'https://host/bin-0.0.2.tar.gz',
            version: '0.0.2',
        });
    });

    test('falls back to the newest published pack, and answers null on an empty map', async () => {
        const module = await loadModule();
        // A build made between two releases has no key of its own.
        appProviderMock.appInfo.version = '2026.08.01';
        stubExtraBinInfo({
            '2026.07.19': {
                url: 'https://host/bin-0.0.1.tar.gz',
                version: '0.0.1',
            },
            '2026.07.26': {
                url: 'https://host/bin-0.0.2.tar.gz',
                version: '0.0.2',
            },
        });

        expect(await module.getExtraBinEntry()).toEqual({
            url: 'https://host/bin-0.0.2.tar.gz',
            version: '0.0.2',
        });

        stubExtraBinInfo({});
        expect(await module.getExtraBinEntry()).toBeNull();

        stubExtraBinInfo(undefined);
        expect(await module.getExtraBinEntry()).toBeNull();
    });

    test('reads the locally built pack in dev instead of the network', async () => {
        appProviderMock.systemUtils.isDev = true;
        const module = await loadModule();
        fsReadFileMock.mockResolvedValue(
            '{"version":"0.0.1","fileFullName":"bin-0.0.1.tar.gz","checksum":"abc"}',
        );

        expect(await module.getExtraBinEntry()).toEqual({
            url: '/repo/extra-work/experiment-building/release/bin-0.0.1.tar.gz',
            version: '0.0.1',
            checksum: 'abc',
        });
        expect(getDownloadTargetUrlMock).not.toHaveBeenCalled();
    });

    test('extracts a downloaded pack and KEEPS the archive for offline repair', async () => {
        const module = await loadModule();
        getFileChecksumMock.mockResolvedValue('abc');

        const isOk = await module.installExtraBin({
            entry: {
                url: 'https://host/bin-0.0.1.tar.gz',
                version: '0.0.1',
                checksum: 'abc',
            },
        });

        expect(isOk).toBe(true);
        expect(ensureDirectoryMock).toHaveBeenCalledWith('/data/extra-bin');
        expect(streamDownloadFileMock).toHaveBeenCalledWith(
            '/data/extra-bin/bin-0.0.1.tar.gz',
            undefined,
            expect.any(Function),
            true,
        );
        expect(tarExtractMock).toHaveBeenCalledWith(
            '/data/extra-bin/bin-0.0.1.tar.gz',
            '/data/extra-bin',
        );
        // The single most important assertion in this file: deleting the
        // archive would break Re-extract, which has to work with no network.
        expect(fsDeleteFileMock).not.toHaveBeenCalledWith(
            '/data/extra-bin/bin-0.0.1.tar.gz',
        );
    });

    test('throws away a pack whose checksum does not match', async () => {
        const module = await loadModule();
        getFileChecksumMock.mockResolvedValue('tampered');

        const isOk = await module.installExtraBin({
            entry: {
                url: 'https://host/bin-0.0.1.tar.gz',
                version: '0.0.1',
                checksum: 'abc',
            },
        });

        expect(isOk).toBe(false);
        expect(fsDeleteFileMock).toHaveBeenCalledWith(
            '/data/extra-bin/bin-0.0.1.tar.gz',
        );
        expect(tarExtractMock).not.toHaveBeenCalled();
    });

    test('re-extracts an archive already on disk without downloading', async () => {
        const module = await loadModule();
        fsListFilesMock.mockResolvedValue(['info.json', 'bin-0.0.1.tar.gz']);

        expect(await module.installExtraBin()).toBe(true);

        expect(streamDownloadFileMock).not.toHaveBeenCalled();
        expect(tarExtractMock).toHaveBeenCalledWith(
            '/data/extra-bin/bin-0.0.1.tar.gz',
            '/data/extra-bin',
        );
    });

    test('an update removes the pack it replaced', async () => {
        const module = await loadModule();
        fsListFilesMock.mockResolvedValue(['bin-0.0.1.tar.gz']);
        getFileChecksumMock.mockResolvedValue('abc');

        await module.installExtraBin({
            entry: {
                url: 'https://host/bin-0.0.2.tar.gz',
                version: '0.0.2',
                checksum: 'abc',
            },
            isForceDownload: true,
            supersededArchiveFileFullName: 'bin-0.0.1.tar.gz',
        });

        expect(tarExtractMock).toHaveBeenCalledWith(
            '/data/extra-bin/bin-0.0.2.tar.gz',
            '/data/extra-bin',
        );
        expect(fsDeleteFileMock).toHaveBeenCalledWith(
            '/data/extra-bin/bin-0.0.1.tar.gz',
        );
    });

    test('reports a pack that extracted without its binaries', async () => {
        const module = await loadModule();
        fsListFilesMock.mockResolvedValue(['bin-0.0.1.tar.gz']);
        checkIsExtraBinInstalledMock.mockResolvedValue({
            isInstalled: false,
            missingNames: ['qjs'],
        });

        expect(await module.installExtraBin()).toBe(false);
        expect(showSimpleToastMock).toHaveBeenCalledWith(
            'Extra Binaries',
            expect.stringContaining('qjs'),
        );
    });
});
