import { beforeEach, describe, expect, test, vi } from 'vitest';

const {
    appProviderMock,
    fsCheckFileExistMock,
    fsReadFileMock,
    showAppConfirmMock,
    openOthersSettingMock,
    defaultStorageMock,
} = vi.hoisted(() => ({
    appProviderMock: {
        systemUtils: { isWindows: true },
    },
    fsCheckFileExistMock: vi.fn(),
    fsReadFileMock: vi.fn(),
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
    fsCheckFileExist: fsCheckFileExistMock,
    fsReadFile: fsReadFileMock,
    pathJoin: (...parts: string[]) => parts.join('/'),
}));

vi.mock('../../setting/directory-setting/appLocalStorage', () => ({
    appLocalStorage: {
        get defaultStorage() {
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
        defaultStorageMock.value = '/data';
    });

    test('lays the pack out under the data parent directory', async () => {
        const module = await loadModule();

        expect(module.getExtraBinDirPath()).toBe('/data/extra-bin');
        expect(module.getExtraBinPaths()).toEqual({
            dirPath: '/data/extra-bin',
            ytDlpBinPath: '/data/extra-bin/yt/yt-dlp.exe',
            // yt-dlp's --ffmpeg-location takes the directory, not the file.
            ffmpegBinDirPath: '/data/extra-bin/ffmpeg/bin',
            ffmpegBinPath: '/data/extra-bin/ffmpeg/bin/ffmpeg.exe',
            qjsBinPath: '/data/extra-bin/qjs/qjs.exe',
        });
    });

    test('drops the .exe suffix off Windows', async () => {
        appProviderMock.systemUtils.isWindows = false;
        const module = await loadModule();
        const paths = module.getExtraBinPaths();

        expect(paths.ytDlpBinPath).toBe('/data/extra-bin/yt/yt-dlp');
        expect(paths.qjsBinPath).toBe('/data/extra-bin/qjs/qjs');
        expect(paths.ffmpegBinPath).toBe('/data/extra-bin/ffmpeg/bin/ffmpeg');
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

        showAppConfirmMock.mockResolvedValue(false);
        expect(await module.requireExtraBinPaths()).toBeNull();
        // Declining must not open anything.
        expect(openOthersSettingMock).toHaveBeenCalledTimes(1);
    });
});
