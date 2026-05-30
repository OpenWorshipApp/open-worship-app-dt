// @vitest-environment jsdom

import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const {
    appProviderMock,
    showSimpleToastMock,
    handleErrorMock,
    showAppConfirmMock,
    goToPathMock,
    fsCheckFileExistMock,
    getDotExtensionFromBase64DataMock,
    getDownloadPathMock,
    isSupportedMimetypeMock,
    pathJoinMock,
    pathResolveMock,
    fileSourceGetInstanceMock,
    fileSourceGetSrcDataMock,
    showProgressBarMessageMock,
    logErrorMock,
    tranMock,
} = vi.hoisted(() => {
    const sendData = vi.fn();
    const sendDataSync = vi.fn();
    const listenOnceForData = vi.fn();
    const copyToClipboard = vi.fn();
    const getYTHelper = vi.fn();

    return {
        appProviderMock: {
            isMainPage: true,
            isPageReader: false,
            isPageScreen: false,
            readerHomePage: '/reader.html',
            systemUtils: {
                copyToClipboard,
            },
            messageUtils: {
                sendData,
                sendDataSync,
                listenOnceForData,
            },
            ytUtils: {
                ffmpegBinPath: '/bin/ffmpeg',
                denoBinPath: '/bin/deno',
                getYTHelper,
            },
        },
        showSimpleToastMock: vi.fn(),
        handleErrorMock: vi.fn(),
        showAppConfirmMock: vi.fn(),
        goToPathMock: vi.fn(),
        fsCheckFileExistMock: vi.fn(),
        getDotExtensionFromBase64DataMock: vi.fn(),
        getDownloadPathMock: vi.fn(() => '/downloads'),
        isSupportedMimetypeMock: vi.fn((type: string, prefix: string) => {
            return type.startsWith(`${prefix}/`);
        }),
        pathJoinMock: vi.fn((...parts: string[]) => parts.join('/')),
        pathResolveMock: vi.fn((value: string) => value),
        fileSourceGetInstanceMock: vi.fn(),
        fileSourceGetSrcDataMock: vi.fn(),
        showProgressBarMessageMock: vi.fn(),
        logErrorMock: vi.fn(),
        tranMock: vi.fn((value: string) => value),
    };
});

vi.mock('./appProvider', () => ({
    default: appProviderMock,
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

vi.mock('../router/routeHelpers', () => ({
    goToPath: goToPathMock,
}));

vi.mock('./fileHelpers', () => ({
    fsCheckFileExist: fsCheckFileExistMock,
    getDotExtensionFromBase64Data: getDotExtensionFromBase64DataMock,
    getDownloadPath: getDownloadPathMock,
    isSupportedMimetype: isSupportedMimetypeMock,
    pathJoin: pathJoinMock,
    pathResolve: pathResolveMock,
}));

vi.mock('../helper/FileSource', () => ({
    default: {
        getInstance: fileSourceGetInstanceMock,
        getSrcDataFromFrom: fileSourceGetSrcDataMock,
    },
}));

vi.mock('../progress-bar/progressBarHelpers', () => ({
    showProgressBarMessage: showProgressBarMessageMock,
}));

vi.mock('../helper/loggerHelpers', () => ({
    appError: logErrorMock,
}));

vi.mock('../lang/langHelpers', () => ({
    tran: tranMock,
}));

vi.mock('../helper/debuggerHelpers', () => ({
    useAppEffect: useEffect,
}));

async function loadModule() {
    vi.resetModules();
    return await import('./appHelpers');
}

function createYtEmitter(
    runEvents: (
        handlers: Record<string, (...args: any[]) => any>,
    ) => Promise<void> | void,
) {
    const handlers: Record<string, (...args: any[]) => any> = {};
    let isScheduled = false;
    const emitter = {
        ytDlpProcess: { pid: 77 },
        on: vi.fn((event: string, callback: (...args: any[]) => void) => {
            handlers[event] = callback;
            if (
                !isScheduled &&
                handlers.progress &&
                handlers.ytDlpEvent &&
                handlers.error &&
                handlers.close
            ) {
                isScheduled = true;
                void Promise.resolve().then(async () => {
                    await runEvents(handlers);
                });
            }
            return emitter;
        }),
    };
    return emitter;
}

describe('appHelpers', () => {
    let container: HTMLDivElement | null = null;
    let root: Root | null = null;
    let consoleLogSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useRealTimers();
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        globalThis.localStorage.clear();
        container = document.createElement('div');
        document.body.appendChild(container);
        consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        appProviderMock.isMainPage = true;
        appProviderMock.isPageReader = false;
        appProviderMock.readerHomePage = '/reader.html';
        appProviderMock.messageUtils.sendData.mockReset();
        appProviderMock.messageUtils.sendDataSync.mockReset();
        appProviderMock.messageUtils.listenOnceForData.mockReset();
        appProviderMock.systemUtils.copyToClipboard.mockReset();
        appProviderMock.ytUtils.getYTHelper.mockReset();
        pathJoinMock.mockImplementation((...parts: string[]) =>
            parts.join('/'),
        );
        pathResolveMock.mockImplementation((value: string) => value);
        getDownloadPathMock.mockReturnValue('/downloads');
        isSupportedMimetypeMock.mockImplementation(
            (type: string, prefix: string) => type.startsWith(`${prefix}/`),
        );
        vi.stubGlobal('crypto', {
            randomUUID: vi.fn(() => 'uuid-123'),
        });
    });

    afterEach(async () => {
        if (root !== null) {
            await act(async () => {
                root?.unmount();
            });
        }
        root = null;
        container?.remove();
        container = null;
        consoleLogSpy.mockRestore();
        vi.unstubAllGlobals();
    });

    test('builds reply event names and resolves electronSendAsync replies', async () => {
        const module = await loadModule();
        appProviderMock.messageUtils.listenOnceForData.mockImplementation(
            (
                _replyEventName: string,
                callback: (event: unknown, value: unknown) => void,
            ) => {
                callback({}, { ok: true });
            },
        );

        expect(module.genReturningEventName('main:app:test')).toBe(
            'main:app:test-return-uuid-123',
        );
        await expect(
            module.electronSendAsync('main:app:test', { value: 3 }),
        ).resolves.toEqual({ ok: true });
        expect(appProviderMock.messageUtils.sendData).toHaveBeenCalledWith(
            'main:app:test',
            { value: 3, replyEventName: 'main:app:test-return-uuid-123' },
        );
    });

    test('rejects electronSendAsync when the reply contains an error', async () => {
        const module = await loadModule();
        appProviderMock.messageUtils.listenOnceForData.mockImplementation(
            (
                _replyEventName: string,
                callback: (event: unknown, value: unknown) => void,
            ) => {
                callback({}, new Error('boom'));
            },
        );

        await expect(module.electronSendAsync('main:app:test')).rejects.toThrow(
            'boom',
        );
    });

    test('delegates explorer, PDF conversion, tar extraction, and clipboard copy', async () => {
        const module = await loadModule();
        appProviderMock.messageUtils.listenOnceForData
            .mockImplementationOnce(
                (
                    _replyEventName: string,
                    callback: (event: unknown, value: unknown) => void,
                ) => {
                    callback({}, null);
                },
            )
            .mockImplementationOnce(
                (
                    _replyEventName: string,
                    callback: (event: unknown, value: unknown) => void,
                ) => {
                    callback({}, undefined);
                },
            )
            .mockImplementationOnce(
                (
                    _replyEventName: string,
                    callback: (event: unknown, value: unknown) => void,
                ) => {
                    callback({}, undefined);
                },
            );

        module.showFileOrDirExplorer('/docs');
        await expect(
            module.convertToPdf('input.docx', 'output.pdf'),
        ).resolves.toBeNull();
        await expect(
            module.tarExtract('archive.tar', '/output'),
        ).resolves.toBeUndefined();
        await expect(
            module.tarCreate('/input', 'archive.tar.gz', ['manifest.json'], true),
        ).resolves.toBeUndefined();
        expect(module.copyToClipboard('lyrics')).toBe(true);

        expect(appProviderMock.messageUtils.sendData).toHaveBeenCalledWith(
            'main:app:reveal-path',
            '/docs',
        );
        expect(
            appProviderMock.systemUtils.copyToClipboard,
        ).toHaveBeenCalledWith('lyrics');
        expect(showSimpleToastMock).toHaveBeenCalledWith(
            'Copy',
            'Text has been copied to clip',
        );
    });

    test('checks and stores the decided bible reader home page flow', async () => {
        let module = await loadModule();

        appProviderMock.isMainPage = false;
        await module.checkDecidedBibleReaderHomePage();
        expect(showAppConfirmMock).not.toHaveBeenCalled();

        appProviderMock.isMainPage = true;
        appProviderMock.isPageReader = true;
        await module.checkDecidedBibleReaderHomePage();
        expect(
            globalThis.localStorage.getItem('decided-reader-home-page'),
        ).toBe('true');

        globalThis.localStorage.clear();
        appProviderMock.isPageReader = false;
        showAppConfirmMock.mockResolvedValueOnce(false);
        await module.checkDecidedBibleReaderHomePage();
        expect(showAppConfirmMock).toHaveBeenCalledTimes(1);
        expect(goToPathMock).not.toHaveBeenCalled();

        globalThis.localStorage.clear();
        showAppConfirmMock.mockResolvedValueOnce(true);
        module = await loadModule();
        await module.checkDecidedBibleReaderHomePage();
        expect(goToPathMock).toHaveBeenCalledWith('/reader.html');
    });

    test('pastes text into inputs and dispatches an input event', async () => {
        const module = await loadModule();
        const input = document.createElement('input');
        input.value = 'old value';
        document.body.appendChild(input);
        const inputListener = vi.fn();
        input.addEventListener('input', inputListener);
        const focusSpy = vi.spyOn(input, 'focus');

        module.pasteTextToInput(input, 'new text');

        expect(focusSpy).toHaveBeenCalledTimes(1);
        expect(input.value).toBe('new text');
        expect(inputListener).toHaveBeenCalledTimes(1);
    });

    test('renames and trashes existing companion material files', async () => {
        const module = await loadModule();
        const renameToMock = vi.fn(async () => undefined);
        const trashMock = vi.fn(async () => undefined);
        fsCheckFileExistMock
            .mockResolvedValueOnce(true)
            .mockResolvedValueOnce(false)
            .mockResolvedValueOnce(true)
            .mockResolvedValueOnce(false);
        fileSourceGetInstanceMock.mockImplementation((filePath: string) => {
            if (filePath.endsWith('.bg.json')) {
                return {
                    name: 'Old Song',
                    renameTo: renameToMock,
                    trash: trashMock,
                };
            }
            return {
                name: 'ignored',
                renameTo: renameToMock,
                trash: trashMock,
            };
        });

        const fileSource = {
            baseDirPath: '/materials',
            fullName: 'Old Song',
            name: 'Old Song',
        } as any;

        await module.renameAllMaterialFiles(fileSource, 'New Song');
        await module.trashAllMaterialFiles(fileSource);

        expect(renameToMock).toHaveBeenCalledWith('New Song');
        expect(trashMock).toHaveBeenCalledTimes(1);
    });

    test('exports bible verses into a timestamped docx file', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2024-01-02T03:04:05.000Z'));
        const module = await loadModule();
        appProviderMock.messageUtils.listenOnceForData.mockImplementation(
            (
                _replyEventName: string,
                callback: (event: unknown, value: unknown) => void,
            ) => {
                callback({}, null);
            },
        );

        await expect(
            module.exportBibleMSWord([
                {
                    title: 'Psalm 1',
                    body: 'Blessed is the one',
                    fontFamily: null,
                },
            ]),
        ).resolves.toBe('/downloads/owa-bible-verses_2024-01-02_03-04-05.docx');
    });

    test('downloads images and reports each failure mode', async () => {
        const module = await loadModule();
        vi.spyOn(Date, 'now').mockReturnValue(111);
        fileSourceGetSrcDataMock.mockResolvedValue(
            'data:image/png;base64,AAAA',
        );
        getDotExtensionFromBase64DataMock.mockReturnValue('.png');
        const writeFileBase64DataSyncMock = vi.fn(() => true);
        fileSourceGetInstanceMock.mockReturnValue({
            fullName: '111.png',
            writeFileBase64DataSync: writeFileBase64DataSyncMock,
        });
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => ({
                ok: true,
                blob: async () => new Blob(['binary'], { type: 'image/png' }),
            })),
        );

        await expect(
            module.downloadImage('https://img', '/out'),
        ).resolves.toEqual({
            filePath: '/out/111.png',
            fileFullName: '111.png',
        });

        (globalThis.fetch as any).mockResolvedValueOnce({ ok: false });
        await expect(
            module.downloadImage('https://img', '/out'),
        ).rejects.toThrow('Download failed: Error: Failed to fetch image');

        (globalThis.fetch as any).mockResolvedValueOnce({
            ok: true,
            blob: async () => new Blob(['binary'], { type: 'image/png' }),
        });
        fileSourceGetSrcDataMock.mockResolvedValueOnce(null);
        await expect(
            module.downloadImage('https://img', '/out'),
        ).rejects.toThrow(
            'Download failed: Error: Failed to extract image data',
        );

        (globalThis.fetch as any).mockResolvedValueOnce({
            ok: true,
            blob: async () => new Blob(['binary'], { type: 'image/png' }),
        });
        fileSourceGetSrcDataMock.mockResolvedValueOnce(
            'data:image/png;base64,AAAA',
        );
        getDotExtensionFromBase64DataMock.mockReturnValueOnce(null);
        await expect(
            module.downloadImage('https://img', '/out'),
        ).rejects.toThrow(
            'Download failed: Error: Failed to get image file extension',
        );

        (globalThis.fetch as any).mockResolvedValueOnce({
            ok: true,
            blob: async () => new Blob(['binary'], { type: 'image/png' }),
        });
        fileSourceGetSrcDataMock.mockResolvedValueOnce(
            'data:image/png;base64,AAAA',
        );
        getDotExtensionFromBase64DataMock.mockReturnValueOnce('.png');
        writeFileBase64DataSyncMock.mockReturnValueOnce(false);
        await expect(
            module.downloadImage('https://img', '/out'),
        ).rejects.toThrow('Download failed: Error: Failed to write image file');
    });

    test('downloads media files through yt-dlp for video and audio flows', async () => {
        const module = await loadModule();
        vi.spyOn(Date, 'now').mockReturnValue(222);
        const first = createYtEmitter((handlers) => {
            handlers.progress({
                percent: '10%',
                totalSize: '1MB',
                currentSpeed: '1x',
                eta: '1s',
            });
            handlers.ytDlpEvent(
                'Merger',
                'Merging formats into "/out/video.mp4"',
            );
            handlers.close();
        });
        const second = createYtEmitter((handlers) => {
            handlers.ytDlpEvent('ExtractAudio', 'Destination: /out/audio.mp3');
            handlers.close();
        });
        const execMock = vi
            .fn()
            .mockReturnValueOnce(first)
            .mockReturnValueOnce(second);
        appProviderMock.ytUtils.getYTHelper.mockResolvedValue({
            exec: execMock,
        });
        fileSourceGetInstanceMock.mockImplementation((filePath: string) => ({
            dotExtension: filePath.endsWith('.mp3') ? '.mp3' : '.mp4',
        }));
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => ({
                text: async () => '<html><title>Sample Title</title></html>',
            })),
        );

        const videoPromise = module.downloadVideoOrAudio(
            ' https://video ',
            '/out',
            true,
        );

        await expect(videoPromise).resolves.toEqual({
            filePath: '/out/video.mp4',
            fileFullName: 'Sample Title.mp4',
        });

        const audioPromise = module.downloadVideoOrAudio(
            'https://audio',
            '/out',
            false,
        );

        await expect(audioPromise).resolves.toEqual({
            filePath: '/out/audio.mp3',
            fileFullName: 'Sample Title.mp3',
        });

        expect(execMock).toHaveBeenNthCalledWith(
            1,
            expect.arrayContaining([
                'https://video',
                '-o',
                '/out/temp-222.%(ext)s',
                '--no-playlist',
            ]),
        );
        expect(execMock).toHaveBeenNthCalledWith(
            2,
            expect.arrayContaining([
                'https://audio',
                '-x',
                '--audio-format',
                'mp3',
            ]),
        );
        expect(showProgressBarMessageMock).toHaveBeenCalledWith(
            'Process id:',
            77,
        );
        expect(showProgressBarMessageMock).toHaveBeenCalledWith('all done');
    });

    test('reuses existing downloads on error and rejects when no file path is available', async () => {
        const module = await loadModule();
        vi.spyOn(Date, 'now').mockReturnValue(333);
        const first = createYtEmitter(async (handlers) => {
            handlers.ytDlpEvent('download', 'Destination: /out/temp-333.mp4');
            await handlers.error(new Error('disk full'));
        });
        const second = createYtEmitter((handlers) => {
            handlers.close();
        });
        appProviderMock.ytUtils.getYTHelper.mockResolvedValue({
            exec: vi
                .fn()
                .mockReturnValueOnce(first)
                .mockReturnValueOnce(second),
        });
        fileSourceGetInstanceMock.mockImplementation((filePath: string) => ({
            dotExtension: filePath.endsWith('.mp4') ? '.mp4' : '.bin',
        }));
        fsCheckFileExistMock.mockResolvedValue(true);
        vi.stubGlobal(
            'fetch',
            vi.fn(() => {
                return Promise.reject(new Error('offline'));
            }),
        );

        const recoveredPromise = module.downloadVideoOrAudio(
            'https://download',
            '/out',
            true,
        );

        await expect(recoveredPromise).resolves.toEqual({
            filePath: '/out/temp-333.mp4',
            fileFullName: 'temp-333.mp4',
        });
        expect(logErrorMock).toHaveBeenCalledWith(
            'Error fetching page:',
            expect.any(Error),
        );
        expect(handleErrorMock).toHaveBeenCalledWith(expect.any(Error));

        fsCheckFileExistMock.mockResolvedValue(false);
        const rejectedPromise = module.downloadVideoOrAudio(
            'https://download',
            '/out',
            true,
        );

        await expect(rejectedPromise).rejects.toThrow(
            'Unable to determine file path',
        );
    });

    test('reads clipboard images and text helpers', async () => {
        const module = await loadModule();
        const imageBlob = new Blob(['image'], { type: 'image/png' });
        const imageItem = {
            types: ['image/png', 'text/plain'],
            getType: vi.fn(async (type: string) => {
                return type === 'image/png'
                    ? imageBlob
                    : new Blob(['text'], { type: 'text/plain' });
            }),
        };
        const textItem = {
            types: ['text/plain'],
            getType: vi.fn(
                async () => new Blob(['text'], { type: 'text/plain' }),
            ),
        };
        const readMock = vi.fn(async () => [imageItem, textItem]);
        const readTextMock = vi.fn(async () => 'copied text');
        vi.stubGlobal('navigator', {
            clipboard: {
                read: readMock,
                readText: readTextMock,
            },
        });

        await expect(module.checkIsImagesInClipboard()).resolves.toBe(true);

        const blobs: Blob[] = [];
        for await (const blob of module.readImagesFromClipboard()) {
            blobs.push(blob);
        }
        expect(blobs).toEqual([imageBlob]);
        await expect(module.readTextFromClipboard()).resolves.toBe(
            'copied text',
        );

        readMock.mockRejectedValueOnce(new Error('no access'));
        await expect(module.checkIsImagesInClipboard()).resolves.toBe(false);

        readTextMock.mockRejectedValueOnce(new Error('blocked'));
        await expect(module.readTextFromClipboard()).resolves.toBeNull();
        expect(handleErrorMock).toHaveBeenCalledWith(expect.any(Error));
    });

    test('formats colors, printing, times, and window-on-top hook state', async () => {
        const module = await loadModule();
        appProviderMock.messageUtils.sendDataSync.mockReturnValue(true);

        expect(module.removeOpacityFromHexColor('#11223344')).toBe('#112233');
        expect(module.removeOpacityFromHexColor('rgb(1,2,3)')).toBe(
            'rgb(1,2,3)',
        );
        module.printHtmlText();
        expect(appProviderMock.messageUtils.sendData).toHaveBeenCalledWith(
            'all:app:print',
        );
        expect(module.timeToTimeString(3661)).toBe('1:1:1');

        function Harness() {
            const [isOnTop, setIsOnTop] = module.useIsOnTop();
            return (
                <div>
                    <span>{isOnTop ? 'on' : 'off'}</span>
                    <button onClick={() => setIsOnTop(false)}>off</button>
                    <button onClick={() => setIsOnTop((prev) => !prev)}>
                        toggle
                    </button>
                </div>
            );
        }

        if (container === null) {
            throw new Error('Missing mount container');
        }
        root = createRoot(container);
        await act(async () => {
            root.render(<Harness />);
        });
        expect(container?.textContent).toContain('on');

        await act(async () => {
            container?.querySelectorAll('button')[0].click();
        });
        await act(async () => {
            container?.querySelectorAll('button')[1].click();
        });

        expect(appProviderMock.messageUtils.sendData).toHaveBeenCalledWith(
            'all:app:set-is-window-on-top',
            { isOnTop: false },
        );
        expect(appProviderMock.messageUtils.sendData).toHaveBeenCalledWith(
            'all:app:set-is-window-on-top',
            { isOnTop: true },
        );
    });
});
