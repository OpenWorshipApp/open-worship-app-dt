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
    notifyExtraBinChangedMock,
    showSimpleToastMock,
    fsMoveMock,
    getExtraBinPlatformNameMock,
    pickPackFileMock,
    readPackFileJsonMock,
    confirmUnverifiedPackFileMock,
    exportPackFileMock,
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
    notifyExtraBinChangedMock: vi.fn(),
    showSimpleToastMock: vi.fn(),
    fsMoveMock: vi.fn(),
    getExtraBinPlatformNameMock: vi.fn(),
    pickPackFileMock: vi.fn(),
    readPackFileJsonMock: vi.fn(),
    confirmUnverifiedPackFileMock: vi.fn(),
    exportPackFileMock: vi.fn(),
}));

vi.mock('../packFileHelpers', () => ({
    pickPackFile: pickPackFileMock,
    readPackFileJson: readPackFileJsonMock,
    confirmUnverifiedPackFile: confirmUnverifiedPackFileMock,
    exportPackFile: exportPackFileMock,
    toNotInstallablePackMessage: (detail: string) => {
        return `not installable: ${detail}`;
    },
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
    fsMove: fsMoveMock,
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
    EXTRA_BIN_INFO_FILE_NAME: 'info.json',
    checkIsExtraBinInstalled: checkIsExtraBinInstalledMock,
    getExtraBinDirPath: () => '/data/extra-bin',
    getExtraBinPlatformName: getExtraBinPlatformNameMock,
    getInstalledExtraBinVersion: getInstalledExtraBinVersionMock,
    moveLegacyExtraBinPack: vi.fn(async () => {}),
    notifyExtraBinChanged: notifyExtraBinChangedMock,
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
        // A promise, as the real one is: the code chains `.catch` on it, and a
        // bare vi.fn() made that line throw a TypeError the install then
        // reported as its failure -- two tests passed for that reason alone.
        fsDeleteFileMock.mockResolvedValue(undefined);
        appProviderMock.systemUtils.isDev = false;
        appProviderMock.appInfo.version = '2026.07.26';
        fsListFilesMock.mockResolvedValue([]);
        checkIsExtraBinInstalledMock.mockResolvedValue({
            isInstalled: true,
            missingNames: [],
        });
        getInstalledExtraBinVersionMock.mockResolvedValue('0.0.1');
        fsMoveMock.mockResolvedValue(undefined);
        getExtraBinPlatformNameMock.mockReturnValue('win');
        confirmUnverifiedPackFileMock.mockResolvedValue(false);
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

    test('a dev app with no local pack: quiet for the launch look, said for a person', async () => {
        appProviderMock.systemUtils.isDev = true;
        const module = await loadModule();
        fsReadFileMock.mockRejectedValue(new Error('ENOENT'));

        expect(await module.getExtraBinEntry(true)).toBeNull();
        expect(showSimpleToastMock).not.toHaveBeenCalled();

        expect(await module.getExtraBinEntry()).toBeNull();
        expect(showSimpleToastMock).toHaveBeenCalledOnce();
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
        // Failed for the mismatch itself -- not for anything thrown on the
        // way to it, which would also answer false.
        expect(showSimpleToastMock).toHaveBeenCalledExactlyOnceWith(
            'Extra Binaries',
            expect.stringContaining(
                'Checksum mismatch: the downloaded pack is corrupted.',
            ),
        );
    });

    test('re-extracts an archive already on disk without downloading', async () => {
        const module = await loadModule();
        fsListFilesMock.mockResolvedValue(['info.json', 'bin-0.0.1.tar.gz']);

        expect(await module.installExtraBin()).toBe(true);
        // Main hears it too: a tunnel waiting for cloudflared starts.
        expect(notifyExtraBinChangedMock).toHaveBeenCalledTimes(1);

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

        const isOk = await module.installExtraBin({
            entry: {
                url: 'https://host/bin-0.0.2.tar.gz',
                version: '0.0.2',
                checksum: 'abc',
            },
            isForceDownload: true,
            supersededArchiveFileFullName: 'bin-0.0.1.tar.gz',
        });

        // The update as a whole went through, not just its first steps.
        expect(isOk).toBe(true);
        expect(notifyExtraBinChangedMock).toHaveBeenCalledOnce();
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
        expect(notifyExtraBinChangedMock).not.toHaveBeenCalled();
    });

    // -- sharing the pack as a file ----------------------------------------

    const PUBLISHED_MAP = {
        '2026.07.19': {
            url: 'https://host/bin-0.0.1.tar.gz',
            version: '0.0.1',
            checksum: 'older-release',
        },
        '2026.07.26': {
            url: 'https://host/bin-0.0.2.tar.gz',
            version: '0.0.2',
            checksum: 'this-release',
        },
    };

    test('a pack a friend saved from an older release installs with no question and replaces every archive here', async () => {
        const module = await loadModule();
        stubExtraBinInfo(PUBLISHED_MAP);
        readPackFileJsonMock.mockResolvedValue({
            version: '0.0.1',
            platform: 'win',
        });
        getFileChecksumMock.mockResolvedValue('older-release');
        fsListFilesMock.mockResolvedValue(['bin-0.0.2.tar.gz']);

        expect(
            await module.importExtraBinFromFile('/usb/bin-0.0.1-win.tar.gz'),
        ).toBe(true);

        expect(readPackFileJsonMock).toHaveBeenCalledWith(
            '/usb/bin-0.0.1-win.tar.gz',
            'info.json',
        );
        expect(confirmUnverifiedPackFileMock).not.toHaveBeenCalled();
        expect(streamDownloadFileMock).not.toHaveBeenCalled();
        // In under the name a download gives it, through a name of its own.
        expect(fsCloneFileMock).toHaveBeenCalledWith(
            '/usb/bin-0.0.1-win.tar.gz',
            '/data/extra-bin/.import-bin-0.0.1.tar.gz',
        );
        expect(fsMoveMock).toHaveBeenCalledWith(
            '/data/extra-bin/.import-bin-0.0.1.tar.gz',
            '/data/extra-bin/bin-0.0.1.tar.gz',
        );
        expect(tarExtractMock).toHaveBeenCalledWith(
            '/data/extra-bin/bin-0.0.1.tar.gz',
            '/data/extra-bin',
        );
        // Re-extract takes the first archive it finds: the old one must go.
        expect(fsDeleteFileMock).toHaveBeenCalledWith(
            '/data/extra-bin/bin-0.0.2.tar.gz',
        );
        expect(fsDeleteFileMock).not.toHaveBeenCalledWith(
            '/data/extra-bin/bin-0.0.1.tar.gz',
            expect.anything(),
        );
        expect(notifyExtraBinChangedMock).toHaveBeenCalledOnce();
    });

    test('picking the archive already here keeps it: copied aside before the target is cleared', async () => {
        const module = await loadModule();
        stubExtraBinInfo(PUBLISHED_MAP);
        readPackFileJsonMock.mockResolvedValue({
            version: '0.0.2',
            platform: 'win',
        });
        getFileChecksumMock.mockResolvedValue('this-release');
        fsListFilesMock.mockResolvedValue(['bin-0.0.2.tar.gz']);

        expect(
            await module.importExtraBinFromFile(
                '/data/extra-bin/bin-0.0.2.tar.gz',
            ),
        ).toBe(true);

        const targetDeleteIndex = fsDeleteFileMock.mock.calls.findIndex(
            ([filePath]) => {
                return filePath === '/data/extra-bin/bin-0.0.2.tar.gz';
            },
        );
        expect(targetDeleteIndex).toBeGreaterThanOrEqual(0);
        expect(fsCloneFileMock.mock.invocationCallOrder[0]).toBeLessThan(
            fsDeleteFileMock.mock.invocationCallOrder[targetDeleteIndex],
        );
        // Deleted once, as the target being replaced -- never again as an
        // "other" archive after the copy landed.
        expect(
            fsDeleteFileMock.mock.calls.filter(([filePath]) => {
                return filePath === '/data/extra-bin/bin-0.0.2.tar.gz';
            }),
        ).toHaveLength(1);
    });

    test('a copy that fails on the way in leaves no half-copied file behind', async () => {
        const module = await loadModule();
        stubExtraBinInfo(PUBLISHED_MAP);
        readPackFileJsonMock.mockResolvedValue({
            version: '0.0.2',
            platform: 'win',
        });
        getFileChecksumMock.mockResolvedValue('this-release');
        fsMoveMock.mockRejectedValue(new Error('EPERM'));

        expect(await module.importExtraBinFromFile('/usb/bin.tar.gz')).toBe(
            false,
        );
        expect(fsDeleteFileMock).toHaveBeenLastCalledWith(
            '/data/extra-bin/.import-bin-0.0.2.tar.gz',
        );
        expect(tarExtractMock).not.toHaveBeenCalled();
        expect(showSimpleToastMock).toHaveBeenCalledWith(
            'Extra Binaries',
            expect.stringContaining('EPERM'),
        );
    });

    test('a pack for another kind of computer is refused before anything is copied', async () => {
        const module = await loadModule();
        readPackFileJsonMock.mockResolvedValue({
            version: '0.0.4',
            platform: 'mac',
        });

        expect(await module.importExtraBinFromFile('/usb/bin.tar.gz')).toBe(
            false,
        );

        const [, message] = showSimpleToastMock.mock.calls[0];
        expect(message).toContain('"mac"');
        expect(message).toContain('"win"');
        expect(getFileChecksumMock).not.toHaveBeenCalled();
        expect(fsCloneFileMock).not.toHaveBeenCalled();
        expect(tarExtractMock).not.toHaveBeenCalled();
    });

    test.each([
        ['no info.json', null],
        ['no platform', { version: '0.0.4' }],
        ['a version that climbs out', { version: '../x', platform: 'win' }],
    ])('a file with %s is no pack', async (_case, info) => {
        const module = await loadModule();
        readPackFileJsonMock.mockResolvedValue(info);

        expect(await module.importExtraBinFromFile('/usb/photo.tar.gz')).toBe(
            false,
        );

        expect(showSimpleToastMock).toHaveBeenCalledWith(
            'Extra Binaries',
            'not installable: "photo.tar.gz"',
        );
        expect(fsCloneFileMock).not.toHaveBeenCalled();
    });

    test('a pack no published one vouches for is asked about, and no changes nothing', async () => {
        const module = await loadModule();
        stubExtraBinInfo(PUBLISHED_MAP);
        readPackFileJsonMock.mockResolvedValue({
            version: '0.0.2',
            platform: 'win',
        });
        getFileChecksumMock.mockResolvedValue('someone-else-built-it');

        expect(await module.importExtraBinFromFile('/usb/bin.tar.gz')).toBe(
            false,
        );
        expect(confirmUnverifiedPackFileMock).toHaveBeenCalledOnce();
        expect(fsCloneFileMock).not.toHaveBeenCalled();
        expect(tarExtractMock).not.toHaveBeenCalled();

        confirmUnverifiedPackFileMock.mockResolvedValue(true);
        expect(await module.importExtraBinFromFile('/usb/bin.tar.gz')).toBe(
            true,
        );
        expect(tarExtractMock).toHaveBeenCalledWith(
            '/data/extra-bin/bin-0.0.2.tar.gz',
            '/data/extra-bin',
        );
    });

    test('offline nothing vouches for the file, so the person is asked', async () => {
        const module = await loadModule();
        getDownloadTargetUrlMock.mockResolvedValue(null);
        readPackFileJsonMock.mockResolvedValue({
            version: '0.0.2',
            platform: 'win',
        });
        getFileChecksumMock.mockResolvedValue('this-release');

        await module.importExtraBinFromFile('/usb/bin.tar.gz');

        expect(confirmUnverifiedPackFileMock).toHaveBeenCalledOnce();
    });

    test('in dev the locally built pack vouches, read without a toast', async () => {
        appProviderMock.systemUtils.isDev = true;
        const module = await loadModule();
        fsReadFileMock.mockResolvedValue(
            '{"version":"0.0.4","fileFullName":"bin-0.0.4.tar.gz","checksum":"abc"}',
        );
        expect(await module.checkIsPublishedExtraBinChecksum('abc')).toBe(true);
        expect(await module.checkIsPublishedExtraBinChecksum('xyz')).toBe(
            false,
        );

        fsReadFileMock.mockRejectedValue(new Error('ENOENT'));
        expect(await module.checkIsPublishedExtraBinChecksum('abc')).toBe(
            false,
        );
        expect(showSimpleToastMock).not.toHaveBeenCalled();
    });

    test('closing the file dialog imports nothing', async () => {
        const module = await loadModule();
        pickPackFileMock.mockResolvedValue(null);

        expect(await module.importExtraBinFromFile()).toBe(false);
        expect(readPackFileJsonMock).not.toHaveBeenCalled();
    });

    test('Export copies the kept archive, named for the computer it runs on', async () => {
        const module = await loadModule();
        fsListFilesMock.mockResolvedValue(['info.json', 'bin-0.0.4.tar.gz']);
        exportPackFileMock.mockResolvedValue('/dl/bin-0.0.4-win.tar.gz');

        expect(await module.exportExtraBinArchive()).toBe(
            '/dl/bin-0.0.4-win.tar.gz',
        );
        expect(exportPackFileMock).toHaveBeenCalledWith(
            'Extra Binaries',
            '/data/extra-bin/bin-0.0.4.tar.gz',
            'bin-0.0.4-win.tar.gz',
        );

        exportPackFileMock.mockClear();
        fsListFilesMock.mockResolvedValue(['info.json']);
        expect(await module.exportExtraBinArchive()).toBeNull();
        expect(exportPackFileMock).not.toHaveBeenCalled();
    });
});
