// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// The `appHelpers` doors the main suite leaves out: saving an embedded image,
// the archive and encryption requests to the main process, a refused clipboard
// write, and the yt-dlp download paths that end in an already-downloaded file
// or a failure that has to sweep its staging files. Every import is mocked in
// this file (the two leaf constant modules excepted).
const h = vi.hoisted(() => {
    return {
        sendData: vi.fn(),
        getYTHelper: vi.fn(),
        electronSendAsync: vi.fn(),
        writeTextToClipboard: vi.fn(),
        showSimpleToast: vi.fn(),
        handleError: vi.fn(),
        showProgressBarMessage: vi.fn(),
        logError: vi.fn(),
        getInstance: vi.fn(),
        getDotExtensionFromBase64Data: vi.fn(),
        fsCheckFileExist: vi.fn(),
        fsDeleteFile: vi.fn(),
        fsListFiles: vi.fn(),
        requireExtraBinPaths: vi.fn(),
    };
});

vi.mock('./appProvider', () => ({
    default: {
        messageUtils: {
            sendData: (...args: unknown[]) => h.sendData(...args),
        },
        ytUtils: {
            getYTHelper: (...args: unknown[]) => h.getYTHelper(...args),
        },
    },
}));
vi.mock('./electronSendHelpers', () => ({
    electronSendAsync: h.electronSendAsync,
    genReturningEventName: (eventName: string) => `${eventName}-return`,
}));
vi.mock('./clipboardHelpers', () => ({
    writeTextToClipboard: h.writeTextToClipboard,
    readTextFromClipboard: vi.fn(),
}));
vi.mock('./onlineHelpHelpers', () => ({ getHelpPageUrl: () => null }));
vi.mock('./mainWindowHelpers', () => ({ checkIsMainWindow: () => true }));
vi.mock('./fileHelpers', () => ({
    fsCheckFileExist: h.fsCheckFileExist,
    fsDeleteFile: h.fsDeleteFile,
    fsListFiles: h.fsListFiles,
    getDotExtensionFromBase64Data: h.getDotExtensionFromBase64Data,
    getDownloadPath: () => '/downloads',
    isSupportedMimetype: () => false,
    pathJoin: (...parts: string[]) => parts.join('/'),
    pathResolve: (value: string) => value,
    toPortableFileName: (name: string, fallbackName: string) => {
        return name === '' ? fallbackName : name;
    },
}));
vi.mock('../helper/FileSource', () => ({
    default: { getInstance: h.getInstance },
}));
vi.mock('../toast/toastHelpers', () => ({
    showSimpleToast: h.showSimpleToast,
}));
vi.mock('../helper/errorHelpers', () => ({ handleError: h.handleError }));
vi.mock('../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('../progress-bar/progressBarHelpers', () => ({
    showProgressBarMessage: h.showProgressBarMessage,
}));
vi.mock('../helper/loggerHelpers', () => ({ appError: h.logError }));
vi.mock('../helper/appHooks', () => ({ useAppEffect: vi.fn() }));
vi.mock('../helper/extra-bin/extraBinHelpers', () => ({
    requireExtraBinPaths: h.requireExtraBinPaths,
}));

import {
    checkIsEncryptedFile,
    copyToClipboard,
    decryptFile,
    downloadImageBase64Data,
    downloadVideoOrAudio,
    encryptFile,
    tarAppend,
} from './appHelpers';

const NOW = 1_700_000_000_000;
const TEMP_NAME = `temp-${NOW}`;
const EXTRA_BIN_PATHS = {
    dirPath: '/extra-bin',
    ytDlpBinPath: '/extra-bin/yt/yt-dlp',
    ffmpegBinDirPath: '/extra-bin/ffmpeg/bin',
    ffmpegBinPath: '/extra-bin/ffmpeg/bin/ffmpeg',
    qjsBinPath: '/extra-bin/qjs/qjs',
};

type Handlers = Record<string, (...args: any[]) => any>;

/** A yt-dlp run whose events the test fires by hand. */
function stubYtDlp() {
    const handlers: Handlers = {};
    const emitter = {
        ytDlpProcess: { pid: 4321 },
        on(eventName: string, handler: (...args: any[]) => any) {
            handlers[eventName] = handler;
            return emitter;
        },
    };
    const exec = vi.fn(() => emitter);
    h.getYTHelper.mockResolvedValue({ exec });
    return { handlers, exec };
}

function stubPage(html: string) {
    vi.stubGlobal(
        'fetch',
        vi.fn(async () => ({ text: async () => html })),
    );
}

async function startDownload(isVideo: boolean) {
    const run = stubYtDlp();
    const downloading = downloadVideoOrAudio(
        'https://example.test/watch?v=1',
        '/media',
        isVideo,
    );
    await vi.waitFor(() => {
        expect(run.handlers.close).toBeDefined();
    });
    return { ...run, downloading };
}

beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    h.requireExtraBinPaths.mockResolvedValue(EXTRA_BIN_PATHS);
    h.getInstance.mockImplementation((filePath: string) => {
        return {
            filePath,
            dotExtension: filePath.slice(filePath.lastIndexOf('.')),
            writeFileBase64DataSync: vi.fn(() => true),
        };
    });
    h.fsDeleteFile.mockResolvedValue(undefined);
    h.fsListFiles.mockResolvedValue([]);
    h.fsCheckFileExist.mockResolvedValue(false);
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('downloadImageBase64Data', () => {
    test('refuses data that is not an image it knows', () => {
        h.getDotExtensionFromBase64Data.mockReturnValue(null);
        expect(downloadImageBase64Data('data:text/plain;base64,aGk=')).toBe(
            null,
        );
        expect(h.showSimpleToast).toHaveBeenCalledExactlyOnceWith(
            'Download',
            'Unsupported image data',
        );
        expect(h.getInstance).not.toHaveBeenCalled();
    });

    test('says so when the image cannot be written', () => {
        h.getDotExtensionFromBase64Data.mockReturnValue('.png');
        h.getInstance.mockReturnValue({
            writeFileBase64DataSync: () => false,
        });
        expect(downloadImageBase64Data('data:image/png;base64,iVBO')).toBe(
            null,
        );
        expect(h.showSimpleToast).toHaveBeenCalledExactlyOnceWith(
            'Download',
            'Failed to save image',
        );
        expect(h.sendData).not.toHaveBeenCalled();
    });

    test('saves the image into Downloads and shows it in the file explorer', () => {
        h.getDotExtensionFromBase64Data.mockReturnValue('.png');
        const srcData = 'data:image/png;base64,iVBO';
        const filePath = `/downloads/owa-image_${NOW}.png`;

        expect(downloadImageBase64Data(srcData)).toBe(filePath);
        expect(h.getInstance).toHaveBeenCalledExactlyOnceWith(filePath);
        const fileSource = h.getInstance.mock.results[0].value;
        expect(fileSource.writeFileBase64DataSync).toHaveBeenCalledWith(
            srcData,
        );
        expect(h.showSimpleToast).toHaveBeenCalledExactlyOnceWith(
            'Download',
            `Image saved at: ${filePath}`,
        );
        expect(h.sendData).toHaveBeenCalledExactlyOnceWith(
            'main:app:reveal-path',
            filePath,
        );
    });
});

describe('main-process requests', () => {
    test('archives and encryption go to the main process with their arguments', async () => {
        h.electronSendAsync.mockImplementation(async (channel: string) => {
            return `${channel}:answer`;
        });
        expect(await tarAppend('/out/a.tar', '/data', ['documents'])).toBe(
            'main:app:tar-append:answer',
        );
        expect(await encryptFile('/out/a.tar', '/out/a.owa', 'secret')).toBe(
            'main:app:file-encrypt:answer',
        );
        expect(await decryptFile('/out/a.owa', '/out/a.tar', 'secret')).toBe(
            'main:app:file-decrypt:answer',
        );
        expect(await checkIsEncryptedFile('/out/a.owa')).toBe(
            'main:app:check-is-encrypted-file:answer',
        );
        expect(h.electronSendAsync.mock.calls).toEqual([
            [
                'main:app:tar-append',
                {
                    archiveFilePath: '/out/a.tar',
                    inputDir: '/data',
                    files: ['documents'],
                },
            ],
            [
                'main:app:file-encrypt',
                {
                    filePath: '/out/a.tar',
                    outputFilePath: '/out/a.owa',
                    password: 'secret',
                },
            ],
            [
                'main:app:file-decrypt',
                {
                    filePath: '/out/a.owa',
                    outputFilePath: '/out/a.tar',
                    password: 'secret',
                },
            ],
            ['main:app:check-is-encrypted-file', { filePath: '/out/a.owa' }],
        ]);
    });
});

describe('copyToClipboard', () => {
    test('a refused clipboard write says nothing and answers false', async () => {
        h.writeTextToClipboard.mockResolvedValue(false);
        expect(await copyToClipboard('John 3:16')).toBe(false);
        expect(h.showSimpleToast).not.toHaveBeenCalled();
    });

    test('a copy is confirmed under the title of what was copied', async () => {
        h.writeTextToClipboard.mockResolvedValue(true);
        expect(await copyToClipboard('graph TD', 'Copy Mermaid')).toBe(true);
        expect(await copyToClipboard('John 3:16')).toBe(true);
        expect(h.showSimpleToast.mock.calls).toEqual([
            ['Copy Mermaid', 'Text has been copied to clipboard'],
            ['Copy', 'Text has been copied to clipboard'],
        ]);
    });
});

describe('downloadVideoOrAudio', () => {
    test('takes a file yt-dlp had already downloaded, named for a page with no title', async () => {
        stubPage('<html><head></head><body>no title</body></html>');
        const { handlers, downloading } = await startDownload(true);

        handlers.ytDlpEvent(
            'download',
            '  /media/temp-1.mp4 has already been downloaded \n',
        );
        await handlers.close();

        await expect(downloading).resolves.toEqual({
            filePath: '/media/temp-1.mp4',
            fileFullName: `${TEMP_NAME}.mp4`,
        });
        expect(h.fsListFiles).not.toHaveBeenCalled();
    });

    test('a failed run with no file sweeps only its own staging files', async () => {
        stubPage('<title>Song</title>');
        h.fsListFiles.mockResolvedValue([
            `${TEMP_NAME}.f137.mp4.part`,
            `${TEMP_NAME}.mp4`,
            'temp-1.mp4',
            'Song.mp4',
        ]);
        const { handlers, downloading } = await startDownload(false);
        const error = new Error('network down');
        await handlers.error(error);

        await expect(downloading).rejects.toThrow(
            'Download failed: network down',
        );
        expect(h.handleError).toHaveBeenCalledExactlyOnceWith(error);
        expect(h.fsListFiles).toHaveBeenCalledExactlyOnceWith('/media');
        expect(h.fsDeleteFile.mock.calls).toEqual([
            [`/media/${TEMP_NAME}.f137.mp4.part`],
            [`/media/${TEMP_NAME}.mp4`],
        ]);
    });

    test('a sweep that fails is reported and the download still fails', async () => {
        stubPage('<title>Song</title>');
        const sweepError = new Error('folder is gone');
        h.fsListFiles.mockRejectedValue(sweepError);
        const { handlers, downloading } = await startDownload(true);
        const error = new Error('network down');
        await handlers.error(error);

        await expect(downloading).rejects.toThrow(
            'Download failed: network down',
        );
        expect(h.handleError.mock.calls).toEqual([[error], [sweepError]]);
        expect(h.fsDeleteFile).not.toHaveBeenCalled();
    });
});
