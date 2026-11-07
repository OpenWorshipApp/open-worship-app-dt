import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// Where the pack comes from when nothing goes to plan: no published entry, an
// info file that will not load, dev with no local build, and a corrupted
// download.
const { appProviderMock, mocks } = vi.hoisted(() => ({
    appProviderMock: {
        systemUtils: { isDev: false },
        appInfo: { version: '2026.07.26' },
        messageUtils: { sendDataSync: (() => '/repo') as () => string },
    },
    mocks: {
        tarExtract: vi.fn(),
        fsCloneFile: vi.fn(),
        fsDeleteFile: vi.fn(),
        fsListFiles: vi.fn(),
        fsReadFile: vi.fn(),
        ensureDirectory: vi.fn(),
        getFileChecksum: vi.fn(),
        streamDownloadFile: vi.fn(),
        initHttpRequest: vi.fn(),
        getDownloadTargetUrl: vi.fn(),
        checkIsExtraBinInstalled: vi.fn(),
        getInstalledExtraBinVersion: vi.fn(),
        notifyExtraBinChanged: vi.fn(),
        showSimpleToast: vi.fn(),
        appError: vi.fn(),
        messageCallback: vi.fn(),
        showProgressBar: vi.fn(),
        hideProgressBar: vi.fn(),
    },
}));

vi.mock('../../server/appProvider', () => ({ default: appProviderMock }));
vi.mock('../../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('../../toast/toastHelpers', () => ({
    showSimpleToast: mocks.showSimpleToast,
}));
vi.mock('../loggerHelpers', () => ({ appError: mocks.appError }));
vi.mock('../../progress-bar/progressBarHelpers', () => ({
    showProgressBar: mocks.showProgressBar,
    hideProgressBar: mocks.hideProgressBar,
}));
vi.mock('../../background/downloadHelper', () => ({
    messageCallback: mocks.messageCallback,
    streamDownloadFile: mocks.streamDownloadFile,
}));
vi.mock('../bible-helpers/downloadHelpers', () => ({
    initHttpRequest: mocks.initHttpRequest,
}));
vi.mock('../../server/appHelpers', () => ({ tarExtract: mocks.tarExtract }));
vi.mock('../../server/unlockingHelpers', () => ({
    unlocking: (_key: string, callback: () => any) => callback(),
}));
vi.mock('../../server/fileHelpers', () => ({
    ensureDirectory: mocks.ensureDirectory,
    fsCloneFile: mocks.fsCloneFile,
    fsDeleteFile: mocks.fsDeleteFile,
    fsListFiles: mocks.fsListFiles,
    fsReadFile: mocks.fsReadFile,
    getFileChecksum: mocks.getFileChecksum,
    pathBasename: (filePath: string) => filePath.split('/').pop(),
    pathJoin: (...parts: string[]) => parts.join('/'),
}));
vi.mock('../../server/updatingAppHelpers', () => ({
    getDownloadTargetUrl: mocks.getDownloadTargetUrl,
    checkIsVersionOutdated: () => false,
}));
vi.mock('./extraBinHelpers', () => ({
    EXTRA_BIN_ARCHIVE_REGEX: /^bin-.+\.tar\.gz$/,
    checkIsExtraBinInstalled: mocks.checkIsExtraBinInstalled,
    getExtraBinDirPath: () => '/data/extra-bin',
    getInstalledExtraBinVersion: mocks.getInstalledExtraBinVersion,
    moveLegacyExtraBinPack: async () => {},
    notifyExtraBinChanged: mocks.notifyExtraBinChanged,
}));

import {
    findLocalExtraBinArchive,
    getExtraBinEntry,
    installExtraBin,
} from './extraBinInstallHelpers';

const DEV_RELEASE_DIR = '/repo/extra-work/experiment-building/release';

beforeEach(() => {
    appProviderMock.systemUtils.isDev = false;
    appProviderMock.appInfo.version = '2026.07.26';
    mocks.fsListFiles.mockResolvedValue([]);
    mocks.fsDeleteFile.mockResolvedValue(undefined);
    mocks.checkIsExtraBinInstalled.mockResolvedValue({
        isInstalled: true,
        missingNames: [],
    });
    mocks.getInstalledExtraBinVersion.mockResolvedValue('0.0.1');
    mocks.getDownloadTargetUrl.mockResolvedValue(
        'https://host/download/win/info.json',
    );
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('getExtraBinEntry', () => {
    test('dev with no locally built pack says how to build one', async () => {
        appProviderMock.systemUtils.isDev = true;
        mocks.fsReadFile.mockRejectedValue(new Error('ENOENT'));
        expect(await getExtraBinEntry()).toBeNull();
        expect(mocks.fsReadFile).toHaveBeenCalledWith(
            `${DEV_RELEASE_DIR}/bin-info.json`,
        );
        expect(mocks.showSimpleToast).toHaveBeenCalledWith(
            'Extra Binaries',
            'No local pack was built yet: run `npm i` (or ' +
                '`node extra-work/build-extra-bin.mjs`) to create one in ' +
                `"${DEV_RELEASE_DIR}"`,
        );
    });

    test('answers null when there is no download target', async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
        mocks.getDownloadTargetUrl.mockResolvedValue(null);
        expect(await getExtraBinEntry()).toBeNull();
        expect(mocks.getDownloadTargetUrl).toHaveBeenCalledWith(true);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    test('logs an info file the server refused, and answers null', async () => {
        const fetchMock = vi.fn(async () => ({
            ok: false,
            statusText: 'Not Found',
            json: async () => ({ extraBin: { x: {} } }),
        }));
        vi.stubGlobal('fetch', fetchMock);
        expect(await getExtraBinEntry()).toBeNull();
        expect(fetchMock).toHaveBeenCalledWith(
            'https://host/download/win/info.json',
            { method: 'GET', cache: 'no-cache' },
        );
        expect(mocks.appError).toHaveBeenCalledWith(
            'Error fetching extra-bin info:',
            new Error('Failed to fetch extra-bin info: Not Found'),
        );
    });

    test('logs a network failure, and answers null', async () => {
        const error = new TypeError('Failed to fetch');
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => {
                throw error;
            }),
        );
        expect(await getExtraBinEntry()).toBeNull();
        expect(mocks.appError).toHaveBeenCalledWith(
            'Error fetching extra-bin info:',
            error,
        );
    });
});

describe('findLocalExtraBinArchive', () => {
    test('finds the kept archive, and answers null when the folder cannot be read', async () => {
        mocks.fsListFiles.mockResolvedValueOnce([
            'info.json',
            'bin-0.0.3.tar.gz',
        ]);
        expect(await findLocalExtraBinArchive('/data/extra-bin')).toBe(
            'bin-0.0.3.tar.gz',
        );
        mocks.fsListFiles.mockResolvedValueOnce(['info.json']);
        expect(await findLocalExtraBinArchive('/data/extra-bin')).toBeNull();
        mocks.fsListFiles.mockRejectedValueOnce(new Error('ENOENT'));
        expect(await findLocalExtraBinArchive('/data/extra-bin')).toBeNull();
    });
});

describe('installExtraBin', () => {
    test('dev copies the locally built pack over any earlier copy', async () => {
        appProviderMock.systemUtils.isDev = true;
        mocks.fsReadFile.mockResolvedValue(
            '{"version":"0.0.1","fileFullName":"bin-0.0.1.tar.gz"}',
        );
        // No earlier copy to delete: logged, not fatal.
        const deleteError = new Error('ENOENT: no earlier copy');
        mocks.fsDeleteFile.mockRejectedValue(deleteError);

        expect(await installExtraBin()).toBe(true);

        expect(mocks.messageCallback).toHaveBeenCalledWith(
            'Copying the locally built pack...',
        );
        expect(mocks.appError).toHaveBeenCalledWith(deleteError);
        expect(mocks.fsCloneFile).toHaveBeenCalledWith(
            `${DEV_RELEASE_DIR}/bin-0.0.1.tar.gz`,
            '/data/extra-bin/bin-0.0.1.tar.gz',
        );
        expect(mocks.initHttpRequest).not.toHaveBeenCalled();
        expect(mocks.tarExtract).toHaveBeenCalledWith(
            '/data/extra-bin/bin-0.0.1.tar.gz',
            '/data/extra-bin',
        );
        expect(mocks.showSimpleToast).toHaveBeenCalledWith(
            'Extra Binaries',
            'Installed "0.0.1"',
        );
    });

    test('a corrupted download is deleted and reported, never extracted', async () => {
        mocks.getFileChecksum.mockResolvedValue('tampered');
        expect(
            await installExtraBin({
                entry: {
                    url: 'https://host/bin-0.0.2.tar.gz',
                    version: '0.0.2',
                    checksum: 'abc',
                },
            }),
        ).toBe(false);
        expect(mocks.messageCallback).toHaveBeenCalledWith('Verifying...');
        expect(mocks.getFileChecksum).toHaveBeenCalledWith(
            '/data/extra-bin/bin-0.0.2.tar.gz',
            'sha512',
        );
        expect(mocks.fsDeleteFile).toHaveBeenCalledWith(
            '/data/extra-bin/bin-0.0.2.tar.gz',
        );
        expect(mocks.tarExtract).not.toHaveBeenCalled();
        expect(mocks.showSimpleToast).toHaveBeenCalledWith(
            'Extra Binaries',
            'Error: Error: Checksum mismatch: the downloaded pack is corrupted.',
        );
        expect(mocks.hideProgressBar).toHaveBeenCalledWith('extra-bin-install');
    });

    test('says no pack is published for this version', async () => {
        mocks.getDownloadTargetUrl.mockResolvedValue(null);
        expect(await installExtraBin()).toBe(false);
        expect(mocks.showSimpleToast).toHaveBeenCalledExactlyOnceWith(
            'Extra Binaries',
            'No pack is available for this app version ("2026.07.26")',
        );
        expect(mocks.streamDownloadFile).not.toHaveBeenCalled();
        expect(mocks.tarExtract).not.toHaveBeenCalled();
        expect(mocks.showProgressBar).toHaveBeenCalledWith('extra-bin-install');
        expect(mocks.hideProgressBar).toHaveBeenCalledWith('extra-bin-install');
    });
});
