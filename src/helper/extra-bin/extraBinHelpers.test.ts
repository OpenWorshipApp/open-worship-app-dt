import { beforeEach, describe, expect, test, vi } from 'vitest';

const {
    appProviderMock,
    fsCheckFileExistMock,
    fsReadFileMock,
    fsListMock,
    fsMoveMock,
    showAppConfirmMock,
    openOthersSettingMock,
    defaultStorageMock,
} = vi.hoisted(() => ({
    appProviderMock: {
        systemUtils: {
            isWindows: true,
            isMac: false,
            isArm64: false,
            is64System: true,
        },
        messageUtils: { sendData: vi.fn() },
    },
    fsCheckFileExistMock: vi.fn(),
    fsReadFileMock: vi.fn(),
    fsListMock: vi.fn(async (): Promise<{ name: string }[]> => []),
    fsMoveMock: vi.fn(async () => {}),
    showAppConfirmMock: vi.fn(),
    openOthersSettingMock: vi.fn(),
    defaultStorageMock: { value: '/data' },
}));

vi.mock('../../server/appProvider', () => ({ default: appProviderMock }));

vi.mock('../../lang/langHelpers', () => ({
    tran: (text: string) => text,
}));

vi.mock('../../popup-widget/popupWidgetHelpers', () => ({
    showAppConfirm: showAppConfirmMock,
}));

vi.mock('../../setting/settingHelpers', () => ({
    openOthersSetting: openOthersSettingMock,
}));

vi.mock('../../server/fileHelpers', () => ({
    ensureDirectory: vi.fn(async () => {}),
    fsCheckFileExist: fsCheckFileExistMock,
    fsList: fsListMock,
    fsMove: fsMoveMock,
    fsReadFile: fsReadFileMock,
    pathJoin: (...parts: string[]) => parts.join('/'),
}));

vi.mock('../errorHelpers', () => ({ handleError: vi.fn() }));

vi.mock('../../setting/directory-setting/appLocalStorage', () => ({
    appLocalStorage: {
        get defaultStorageDirPath() {
            return defaultStorageMock.value;
        },
    },
}));

async function loadModule() {
    vi.resetModules();
    return await import('./extraBinHelpers');
}

describe('extraBinHelpers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        appProviderMock.systemUtils.isWindows = true;
        appProviderMock.systemUtils.isMac = false;
        appProviderMock.systemUtils.isArm64 = false;
        defaultStorageMock.value = '/data';
    });

    test('lays the pack out under the data parent directory', async () => {
        const module = await loadModule();

        expect(module.getExtraBinDirPath()).toBe('/data/extra-bin/win');
        expect(module.getExtraBinPaths()).toEqual({
            dirPath: '/data/extra-bin/win',
            ytDlpBinPath: '/data/extra-bin/win/yt/yt-dlp.exe',
            // yt-dlp's --ffmpeg-location takes the directory, not the file.
            ffmpegBinDirPath: '/data/extra-bin/win/ffmpeg/bin',
            ffmpegBinPath: '/data/extra-bin/win/ffmpeg/bin/ffmpeg.exe',
            qjsBinPath: '/data/extra-bin/win/qjs/qjs.exe',
        });
    });

    test('drops the .exe suffix off Windows', async () => {
        appProviderMock.systemUtils.isWindows = false;
        const module = await loadModule();
        const paths = module.getExtraBinPaths();

        expect(paths.ytDlpBinPath).toBe('/data/extra-bin/linux/yt/yt-dlp');
        expect(paths.qjsBinPath).toBe('/data/extra-bin/linux/qjs/qjs');
        expect(paths.ffmpegBinPath).toBe(
            '/data/extra-bin/linux/ffmpeg/bin/ffmpeg',
        );
    });

    test('keeps one pack per OS and processor, named as the packs are built', async () => {
        const module = await loadModule();
        const { systemUtils } = appProviderMock;
        expect(module.getExtraBinPlatformName()).toBe('win');
        systemUtils.isArm64 = true;
        expect(module.getExtraBinPlatformName()).toBe('win-arm64');
        systemUtils.isWindows = false;
        systemUtils.isMac = true;
        expect(module.getExtraBinPlatformName()).toBe('mac');
        systemUtils.isArm64 = false;
        expect(module.getExtraBinPlatformName()).toBe('mac-int');
        systemUtils.isMac = false;
        expect(module.getExtraBinPlatformName()).toBe('linux');
    });

    test('moves a pack from before the per-OS folders into its own', async () => {
        const module = await loadModule();
        fsCheckFileExistMock.mockImplementation(async (filePath: string) => {
            return filePath === '/data/extra-bin/info.json';
        });
        fsReadFileMock.mockResolvedValue('{"version":"1","platform":"win"}');
        fsListMock.mockResolvedValue([
            { name: 'yt' },
            { name: 'ffmpeg' },
            { name: 'qjs' },
            { name: 'info.json' },
            { name: 'bin-1.tar.gz' },
            { name: 'mac' },
        ]);

        await module.checkIsExtraBinInstalled();

        expect(fsMoveMock.mock.calls).toEqual([
            ['/data/extra-bin/yt', '/data/extra-bin/win/yt'],
            ['/data/extra-bin/ffmpeg', '/data/extra-bin/win/ffmpeg'],
            ['/data/extra-bin/qjs', '/data/extra-bin/win/qjs'],
            ['/data/extra-bin/info.json', '/data/extra-bin/win/info.json'],
            [
                '/data/extra-bin/bin-1.tar.gz',
                '/data/extra-bin/win/bin-1.tar.gz',
            ],
        ]);
    });

    test("leaves another OS's old pack where it is", async () => {
        appProviderMock.systemUtils.isWindows = false;
        appProviderMock.systemUtils.isMac = true;
        appProviderMock.systemUtils.isArm64 = true;
        const module = await loadModule();
        fsCheckFileExistMock.mockImplementation(async (filePath: string) => {
            return filePath === '/data/extra-bin/info.json';
        });
        fsReadFileMock.mockResolvedValue('{"version":"1","platform":"win"}');

        expect(await module.checkIsExtraBinInstalled()).toEqual({
            isInstalled: false,
            missingNames: ['yt-dlp', 'ffmpeg', 'qjs'],
        });
        expect(fsMoveMock).not.toHaveBeenCalled();
    });

    test('names exactly which binaries are missing', async () => {
        const module = await loadModule();
        fsCheckFileExistMock.mockImplementation(async (filePath: string) => {
            return !filePath.includes('ffmpeg');
        });

        expect(await module.checkIsExtraBinInstalled()).toEqual({
            isInstalled: false,
            missingNames: ['ffmpeg'],
        });

        fsCheckFileExistMock.mockResolvedValue(true);
        expect(await module.checkIsExtraBinInstalled()).toEqual({
            isInstalled: true,
            missingNames: [],
        });
    });

    test('reads the installed version, and survives a missing or broken info file', async () => {
        const module = await loadModule();

        fsReadFileMock.mockResolvedValue('{"version":"0.0.1"}');
        expect(await module.getInstalledExtraBinVersion()).toBe('0.0.1');

        fsReadFileMock.mockRejectedValue(new Error('ENOENT'));
        expect(await module.getInstalledExtraBinVersion()).toBeNull();

        fsReadFileMock.mockResolvedValue('not json at all');
        expect(await module.getInstalledExtraBinVersion()).toBeNull();

        fsReadFileMock.mockResolvedValue('{"version":123}');
        expect(await module.getInstalledExtraBinVersion()).toBeNull();
    });

    test('hands the paths over when the pack is installed', async () => {
        const module = await loadModule();
        fsCheckFileExistMock.mockResolvedValue(true);

        expect(await module.requireExtraBinPaths()).toEqual(
            module.getExtraBinPaths(),
        );
        expect(showAppConfirmMock).not.toHaveBeenCalled();
    });

    test('offers the settings panel when the pack is missing, and answers null either way', async () => {
        const module = await loadModule();
        fsCheckFileExistMock.mockResolvedValue(false);

        showAppConfirmMock.mockResolvedValue(true);
        expect(await module.requireExtraBinPaths()).toBeNull();
        expect(openOthersSettingMock).toHaveBeenCalledTimes(1);
        // The panel being raised lives in another renderer and may already be
        // showing a stale "installed" answer, so it has to be told.
        expect(appProviderMock.messageUtils.sendData).toHaveBeenCalledWith(
            'all:app:extra-bin-changed',
        );

        appProviderMock.messageUtils.sendData.mockClear();
        showAppConfirmMock.mockResolvedValue(false);
        expect(await module.requireExtraBinPaths()).toBeNull();
        // Declining must not open anything.
        expect(openOthersSettingMock).toHaveBeenCalledTimes(1);
        expect(appProviderMock.messageUtils.sendData).not.toHaveBeenCalled();
    });
});
