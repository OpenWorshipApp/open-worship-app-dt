import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const {
    checkIsExtraBinInstalledMock,
    getInstalledExtraBinVersionMock,
    getExtraBinEntryMock,
    installExtraBinMock,
    findLocalExtraBinArchiveMock,
    showAppConfirmMock,
    reportPackageUpdatesMock,
    extraBinPaths,
} = vi.hoisted(() => ({
    checkIsExtraBinInstalledMock: vi.fn(),
    getInstalledExtraBinVersionMock: vi.fn(),
    getExtraBinEntryMock: vi.fn(),
    installExtraBinMock: vi.fn(),
    findLocalExtraBinArchiveMock: vi.fn(),
    showAppConfirmMock: vi.fn(),
    reportPackageUpdatesMock: vi.fn(),
    extraBinPaths: {
        dirPath: '/data/extra-bin/win',
        ytDlpBinPath: '/data/extra-bin/win/yt/yt-dlp.exe',
        ffmpegBinDirPath: '/data/extra-bin/win/ffmpeg/bin',
        ffmpegBinPath: '/data/extra-bin/win/ffmpeg/bin/ffmpeg.exe',
        qjsBinPath: '/data/extra-bin/win/qjs/qjs.exe',
        cloudflaredBinPath: '/data/extra-bin/win/cloudflared/cloudflared.exe',
    },
}));

vi.mock('../../lang/langHelpers', () => ({
    tran: (text: string) => text,
}));

vi.mock('../../popup-widget/popupWidgetHelpers', () => ({
    showAppConfirm: showAppConfirmMock,
}));

vi.mock('../../server/updatingAppHelpers', () => ({
    checkIsVersionOutdated: (current: string, latest: string) => {
        return current < latest;
    },
}));

vi.mock('../packageUpdateHelpers', () => ({
    reportPackageUpdates: reportPackageUpdatesMock,
}));

vi.mock('./extraBinHelpers', () => ({
    EXTRA_BIN_MEDIA_NAMES: ['yt-dlp', 'ffmpeg', 'qjs'],
    checkIsExtraBinInstalled: checkIsExtraBinInstalledMock,
    getExtraBinDirPath: () => '/data/extra-bin/win',
    getExtraBinPaths: () => extraBinPaths,
    getInstalledExtraBinVersion: getInstalledExtraBinVersionMock,
}));

vi.mock('./extraBinInstallHelpers', () => ({
    findLocalExtraBinArchive: findLocalExtraBinArchiveMock,
    getExtraBinEntry: getExtraBinEntryMock,
    installExtraBin: installExtraBinMock,
}));

const MISSING = {
    isInstalled: false,
    missingNames: ['yt-dlp', 'ffmpeg', 'qjs'],
};
const PRESENT = { isInstalled: true, missingNames: [] };
const ENTRY_0_0_5 = { url: 'https://host/bin-0.0.5.tar.gz', version: '0.0.5' };

async function loadModule() {
    vi.resetModules();
    return await import('./extraBinGateHelpers');
}

describe('requireExtraBinPaths', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        installExtraBinMock.mockResolvedValue(true);
        findLocalExtraBinArchiveMock.mockResolvedValue('bin-0.0.4.tar.gz');
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    test('an installed, current pack is handed over with no question', async () => {
        const module = await loadModule();
        checkIsExtraBinInstalledMock.mockResolvedValue(PRESENT);
        getInstalledExtraBinVersionMock.mockResolvedValue('0.0.5');
        getExtraBinEntryMock.mockResolvedValue(ENTRY_0_0_5);

        expect(await module.requireExtraBinPaths()).toEqual(extraBinPaths);
        expect(showAppConfirmMock).not.toHaveBeenCalled();
        expect(installExtraBinMock).not.toHaveBeenCalled();
        // The media download asks for its own three tools only.
        expect(checkIsExtraBinInstalledMock).toHaveBeenCalledWith([
            'yt-dlp',
            'ffmpeg',
            'qjs',
        ]);
        // Quiet: a dev app with no local pack must not toast on a download.
        expect(getExtraBinEntryMock).toHaveBeenCalledWith(true);
        expect(reportPackageUpdatesMock).toHaveBeenCalledWith({
            isExtraBinOutdated: false,
        });
    });

    test('a missing pack is installed right here once confirmed, and the download goes on', async () => {
        const module = await loadModule();
        checkIsExtraBinInstalledMock
            .mockResolvedValueOnce(MISSING)
            .mockResolvedValueOnce(PRESENT);
        showAppConfirmMock.mockResolvedValue(true);

        expect(await module.requireExtraBinPaths()).toEqual(extraBinPaths);
        expect(showAppConfirmMock).toHaveBeenCalledTimes(1);
        const [title, message, options] = showAppConfirmMock.mock.calls[0];
        expect(title).toBe('Media Tools Required');
        expect(message).toContain('(yt-dlp, ffmpeg, qjs)');
        expect(message).toContain(
            'Would you like to download and install them now?',
        );
        // A raw dictionary key: the dialog translates its own buttons.
        expect(options).toEqual({ confirmButtonLabel: 'Download and Install' });
        expect(installExtraBinMock).toHaveBeenCalledWith();
        // Nothing to update right after a fresh install.
        expect(getExtraBinEntryMock).not.toHaveBeenCalled();
    });

    test('declining the install downloads nothing', async () => {
        const module = await loadModule();
        checkIsExtraBinInstalledMock.mockResolvedValue(MISSING);
        showAppConfirmMock.mockResolvedValue(false);

        expect(await module.requireExtraBinPaths()).toBeNull();
        expect(installExtraBinMock).not.toHaveBeenCalled();
    });

    test('an install that leaves the media tools missing downloads nothing', async () => {
        const module = await loadModule();
        checkIsExtraBinInstalledMock.mockResolvedValue(MISSING);
        showAppConfirmMock.mockResolvedValue(true);
        installExtraBinMock.mockResolvedValue(false);

        expect(await module.requireExtraBinPaths()).toBeNull();
        expect(installExtraBinMock).toHaveBeenCalledTimes(1);
    });

    // The install's own check also wants cloudflared; a pack without it still
    // downloads video and audio.
    test('an install that fails only for cloudflared still downloads', async () => {
        const module = await loadModule();
        checkIsExtraBinInstalledMock
            .mockResolvedValueOnce(MISSING)
            .mockResolvedValueOnce(PRESENT);
        showAppConfirmMock.mockResolvedValue(true);
        installExtraBinMock.mockResolvedValue(false);

        expect(await module.requireExtraBinPaths()).toEqual(extraBinPaths);
    });

    test('an older pack is offered an update, and updated before the download', async () => {
        const module = await loadModule();
        checkIsExtraBinInstalledMock.mockResolvedValue(PRESENT);
        getInstalledExtraBinVersionMock.mockResolvedValue('0.0.4');
        getExtraBinEntryMock.mockResolvedValue(ENTRY_0_0_5);
        showAppConfirmMock.mockResolvedValue(true);

        expect(await module.requireExtraBinPaths()).toEqual(extraBinPaths);
        const [title, message, options] = showAppConfirmMock.mock.calls[0];
        expect(title).toBe('Update Available');
        expect(message).toContain('(0.0.4 → 0.0.5)');
        expect(options).toEqual({
            cancelButtonLabel: 'Not Now',
            confirmButtonLabel: 'Update',
        });
        // The Settings panel's Update: fetched afresh, the old archive goes.
        expect(installExtraBinMock).toHaveBeenCalledWith({
            entry: ENTRY_0_0_5,
            isForceDownload: true,
            supersededArchiveFileFullName: 'bin-0.0.4.tar.gz',
        });
        expect(reportPackageUpdatesMock.mock.calls).toEqual([
            [{ isExtraBinOutdated: true }],
            [{ isExtraBinOutdated: false }],
        ]);
        // Looked at again after the install.
        expect(checkIsExtraBinInstalledMock).toHaveBeenCalledTimes(2);
    });

    test('Not Now downloads with the pack already installed', async () => {
        const module = await loadModule();
        checkIsExtraBinInstalledMock.mockResolvedValue(PRESENT);
        getInstalledExtraBinVersionMock.mockResolvedValue('0.0.4');
        getExtraBinEntryMock.mockResolvedValue(ENTRY_0_0_5);
        showAppConfirmMock.mockResolvedValue(false);

        expect(await module.requireExtraBinPaths()).toEqual(extraBinPaths);
        expect(installExtraBinMock).not.toHaveBeenCalled();
        // The gear keeps its sign: the update is still there.
        expect(reportPackageUpdatesMock.mock.calls).toEqual([
            [{ isExtraBinOutdated: true }],
        ]);
    });

    test('an update that broke the pack downloads nothing', async () => {
        const module = await loadModule();
        checkIsExtraBinInstalledMock
            .mockResolvedValueOnce(PRESENT)
            .mockResolvedValueOnce(MISSING);
        getInstalledExtraBinVersionMock.mockResolvedValue('0.0.4');
        getExtraBinEntryMock.mockResolvedValue(ENTRY_0_0_5);
        showAppConfirmMock.mockResolvedValue(true);
        installExtraBinMock.mockResolvedValue(false);

        expect(await module.requireExtraBinPaths()).toBeNull();
        // A failed update clears no sign.
        expect(reportPackageUpdatesMock.mock.calls).toEqual([
            [{ isExtraBinOutdated: true }],
        ]);
    });

    test('offline, or with no version to compare, nothing is asked', async () => {
        const module = await loadModule();
        checkIsExtraBinInstalledMock.mockResolvedValue(PRESENT);

        getInstalledExtraBinVersionMock.mockResolvedValue('0.0.4');
        getExtraBinEntryMock.mockResolvedValue(null);
        expect(await module.requireExtraBinPaths()).toEqual(extraBinPaths);

        getExtraBinEntryMock.mockRejectedValue(new Error('offline'));
        expect(await module.requireExtraBinPaths()).toEqual(extraBinPaths);

        getInstalledExtraBinVersionMock.mockResolvedValue(null);
        getExtraBinEntryMock.mockClear();
        expect(await module.requireExtraBinPaths()).toEqual(extraBinPaths);
        expect(getExtraBinEntryMock).not.toHaveBeenCalled();

        expect(showAppConfirmMock).not.toHaveBeenCalled();
        expect(reportPackageUpdatesMock).not.toHaveBeenCalled();
    });

    test('a network that hangs does not hold the download up', async () => {
        vi.useFakeTimers();
        const module = await loadModule();
        checkIsExtraBinInstalledMock.mockResolvedValue(PRESENT);
        getInstalledExtraBinVersionMock.mockResolvedValue('0.0.4');
        getExtraBinEntryMock.mockReturnValue(new Promise(() => {}));

        const pathsPromise = module.requireExtraBinPaths();
        await vi.advanceTimersByTimeAsync(
            module.EXTRA_BIN_UPDATE_CHECK_TIMEOUT_MILLISECONDS,
        );
        expect(await pathsPromise).toEqual(extraBinPaths);
        expect(showAppConfirmMock).not.toHaveBeenCalled();
    });
});
