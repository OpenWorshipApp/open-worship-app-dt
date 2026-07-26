// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const {
    showSimpleToastMock,
    handleErrorMock,
    showProgressBarMock,
    hideProgressBarMock,
    tranMock,
} = vi.hoisted(() => ({
    showSimpleToastMock: vi.fn(),
    handleErrorMock: vi.fn(),
    showProgressBarMock: vi.fn(),
    hideProgressBarMock: vi.fn(),
    tranMock: vi.fn((value: string) => value),
}));

vi.mock('../toast/toastHelpers', () => ({
    showSimpleToast: showSimpleToastMock,
}));

vi.mock('../helper/errorHelpers', () => ({
    handleError: handleErrorMock,
}));

vi.mock('../progress-bar/progressBarHelpers', () => ({
    showProgressBar: showProgressBarMock,
    hideProgressBar: hideProgressBarMock,
}));

vi.mock('../lang/langHelpers', () => ({
    tran: tranMock,
}));

// jsdom's `Blob` has no `stream()`, which `fsCloneFile` needs to pipe an
// uploaded file onto disk
function createUploadFile(
    content: string,
    fileName: string,
    type = 'text/plain',
) {
    const file = new File([content], fileName, { type });
    Object.defineProperty(file, 'stream', {
        configurable: true,
        value: () => {
            return new ReadableStream({
                start(controller) {
                    controller.enqueue(new TextEncoder().encode(content));
                    controller.close();
                },
            });
        },
    });
    return file;
}

async function loadModules(pathname = '/setting.html') {
    vi.resetModules();
    globalThis.localStorage.clear();
    history.replaceState(null, '', pathname);
    document.title = 'File Helpers';

    const [fileHelpers, { default: appProvider }] = await Promise.all([
        import('./fileHelpers'),
        import('./appProvider'),
    ]);

    return { fileHelpers, appProvider };
}

describe('fileHelpers', () => {
    let consoleLogSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useRealTimers();
        vi.unstubAllGlobals();
        globalThis.localStorage.clear();
        consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        consoleLogSpy.mockRestore();
        vi.unstubAllGlobals();
    });

    test('exposes path and mimetype helpers', async () => {
        const { fileHelpers } = await loadModules();
        const [appDocumentExt] =
            fileHelpers.getMimetypeExtensions('appDocument');

        expect(fileHelpers.checkIsAppFile(`deck.${appDocumentExt}`)).toBe(true);
        expect(fileHelpers.pathSeparator).toBe('/');
        expect(fileHelpers.pathJoin('/browser-data', 'docs', 'song.txt')).toBe(
            '/browser-data/docs/song.txt',
        );
        expect(fileHelpers.pathResolve('/browser-data/docs/')).toBe(
            '/browser-data/docs',
        );
        expect(fileHelpers.pathBasename('/browser-data/docs/song.txt')).toBe(
            'song.txt',
        );
        expect(fileHelpers.getFileName('song.txt')).toBe('song');
        expect(fileHelpers.getFileDotExtension('song.txt')).toBe('.txt');
        expect(fileHelpers.addExtension('song', '.txt')).toBe('song.txt');
        expect(
            fileHelpers.getFileMetaData(`deck.${appDocumentExt}`)?.appMimetype
                .mimetypeName,
        ).toBe('appDocument');
        expect(fileHelpers.getAllAppMimetype().length).toBeGreaterThan(0);
        expect(fileHelpers.getAppMimetype('other')).toEqual([]);
        expect(fileHelpers.isSupportedMimetype('image/png', 'image')).toBe(
            true,
        );
        expect(fileHelpers.isSupportedExt('cover.png', 'image')).toBe(true);
        expect(
            fileHelpers.getDotExtensionFromBase64Data(
                'data:image/png;base64,AAAA',
            ),
        ).toBe('.png');
        expect(
            fileHelpers.getDotExtensionFromBase64Data(
                'data:text/plain;base64,QQ==',
            ),
        ).toBeNull();
    });

    test('creates, writes, lists, renames, and deletes files in the browser mock fs', async () => {
        const { fileHelpers } = await loadModules();
        const baseDir = '/browser-data/projects';

        await fileHelpers.fsCreateDir(baseDir);
        await fileHelpers.fsCreateFile(`${baseDir}/note.txt`, 'hello');

        expect(await fileHelpers.fsCheckDirExist(baseDir)).toBe(true);
        expect(await fileHelpers.fsCheckFileExist(baseDir, 'note.txt')).toBe(
            true,
        );
        expect(await fileHelpers.fsReadFile(`${baseDir}/note.txt`)).toBe(
            'hello',
        );

        await fileHelpers.fsWriteFile(`${baseDir}/note.txt`, 'world');
        expect(fileHelpers.fsReadSync(`${baseDir}/note.txt`)).toBe('world');

        fileHelpers.fsWriteFileSync(`${baseDir}/second.txt`, 'two');
        expect(fileHelpers.fsExistSync(`${baseDir}/second.txt`)).toBe(true);

        await fileHelpers.fsCreateDir(`${baseDir}/visible`);
        await fileHelpers.fsCreateDir(`${baseDir}/.hidden`);

        const listedNames = (await fileHelpers.fsList(baseDir)).map((item) => {
            return item.name;
        });
        expect(listedNames).toEqual(
            expect.arrayContaining([
                'note.txt',
                'second.txt',
                'visible',
                '.hidden',
            ]),
        );
        expect(await fileHelpers.fsListFiles(baseDir)).toEqual(
            expect.arrayContaining(['note.txt', 'second.txt']),
        );
        expect(await fileHelpers.fsListDirectories(baseDir)).toEqual([
            'visible',
        ]);

        await fileHelpers.fsRenameFile(baseDir, 'note.txt', 'renamed.txt');
        expect(
            await fileHelpers.fsCheckFileExist(`${baseDir}/renamed.txt`),
        ).toBe(true);

        await fileHelpers.fsDeleteFile(`${baseDir}/renamed.txt`);
        expect(
            await fileHelpers.fsCheckFileExist(`${baseDir}/renamed.txt`),
        ).toBe(false);

        await fileHelpers.fsDeleteDir(`${baseDir}/visible`);
        expect(await fileHelpers.fsCheckDirExist(`${baseDir}/visible`)).toBe(
            false,
        );
    });

    test('creates typed files and handles duplicate and override flows', async () => {
        const { fileHelpers } = await loadModules();
        const dirPath = '/browser-data/new';
        const [playlistExt] = fileHelpers.getMimetypeExtensions('playlist');

        await fileHelpers.fsCreateDir(dirPath);
        await expect(
            fileHelpers.createNewFileDetail(
                dirPath,
                'setlist',
                '[]',
                'playlist',
            ),
        ).resolves.toBe(`${dirPath}/setlist.${playlistExt}`);
        await expect(
            fileHelpers.fsCreateFile(
                `${dirPath}/setlist.${playlistExt}`,
                'updated',
                true,
            ),
        ).resolves.toBe(`${dirPath}/setlist.${playlistExt}`);
        expect(
            await fileHelpers.fsReadFile(`${dirPath}/setlist.${playlistExt}`),
        ).toBe('updated');
        await expect(
            fileHelpers.createNewFileDetail(
                dirPath,
                'setlist',
                '[]',
                'playlist',
            ),
        ).resolves.toBeNull();
        expect(showSimpleToastMock).toHaveBeenCalledWith(
            'Creating Playlist',
            'File exist',
        );
        await expect(
            fileHelpers.createNewFileDetail(dirPath, 'unknown', '{}', 'other'),
        ).rejects.toThrow('No extensions found for mimetype: other');
    });

    test('copies files, resolves filenames, and lists files by mimetype', async () => {
        const { fileHelpers, appProvider } = await loadModules();
        const mediaDir = '/browser-data/media';
        const copyDir = '/browser-data/copies';
        const pngBase64 =
            'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=';

        await fileHelpers.fsCreateDir(mediaDir);
        await fileHelpers.fsCreateDir(copyDir);
        fileHelpers.writeFileFromBase64Sync(
            `${mediaDir}/picture.png`,
            pngBase64,
        );

        const matchedFiles = await fileHelpers.fsListFilesWithMimetype(
            mediaDir,
            'image',
        );
        expect(matchedFiles).toEqual([`${mediaDir}/picture.png`]);

        const copiedPath = await fileHelpers.fsCopyFilePathToPath(
            `${mediaDir}/picture.png`,
            copyDir,
        );
        expect(copiedPath).toBe(`${copyDir}/picture.png`);
        expect(
            await fileHelpers.fsCheckFileExist(`${copyDir}/picture.png`),
        ).toBe(true);

        const uploadedFile = new File(['alpha'], 'upload.txt', {
            type: 'text/plain',
        });
        const writeStream = appProvider.fileUtils.createWriteStream(
            `${copyDir}/upload.txt`,
        );
        const closePromise = new Promise<void>((resolve) => {
            writeStream.once('close', resolve);
        });
        writeStream.write('alpha');
        writeStream.end();
        await closePromise;
        expect(await fileHelpers.fsReadFile(`${copyDir}/upload.txt`)).toBe(
            'alpha',
        );

        expect(fileHelpers.getFileFullName(uploadedFile)).toBe('upload.txt');
        expect(fileHelpers.getFileFullName(`${copyDir}/upload.txt`)).toBe(
            'upload.txt',
        );

        await expect(
            fileHelpers.fsCopyFilePathToPath(new Blob(['x']), copyDir),
        ).resolves.toBeNull();
        expect(handleErrorMock).toHaveBeenCalledWith(expect.any(Error));
        expect(showSimpleToastMock).toHaveBeenCalledWith(
            'Copying File:undefined',
            'Error occurred during copying file: Cannot get file name',
        );
        expect(showProgressBarMock).toHaveBeenCalled();
        expect(hideProgressBarMock).toHaveBeenCalled();
    });

    test('handles special paths, selection helpers, hashes, base64 conversion, and provider state', async () => {
        const { fileHelpers, appProvider } =
            await loadModules('/presenter.html');

        appProvider.messageUtils.listenForData(
            'main:app:select-dirs',
            (_event, payload) => {
                appProvider.messageUtils.sendData(payload.replyEventName, [
                    '/browser-data/desktop',
                ]);
            },
        );
        appProvider.messageUtils.listenForData(
            'main:app:select-files',
            (_event, payload) => {
                appProvider.messageUtils.sendData(payload.replyEventName, [
                    '/browser-data/downloads/pic.png',
                ]);
            },
        );

        await expect(fileHelpers.selectDirs()).resolves.toEqual([
            '/browser-data/desktop',
        ]);
        await expect(
            fileHelpers.selectFiles([{ name: 'Images', extensions: ['png'] }]),
        ).resolves.toEqual(['/browser-data/downloads/pic.png']);

        expect(fileHelpers.getUserWritablePath()).toBe('/browser-data');
        expect(fileHelpers.getDesktopPath()).toBe('/browser-data/desktop');
        expect(fileHelpers.getDownloadPath()).toBe('/browser-data/downloads');
        expect(fileHelpers.getTempPath()).toBe('/browser-data/temp');

        await fileHelpers.ensureDirectory('/browser-data/ensured');
        expect(await fileHelpers.fsCheckDirExist('/browser-data/ensured')).toBe(
            true,
        );

        await fileHelpers.fsCreateFile('/browser-data/hash.txt', 'content');
        await expect(
            fileHelpers.ensureDirectory('/browser-data/hash.txt'),
        ).rejects.toThrow('a file already exists at that path');
        await expect(
            fileHelpers.getFileMD5('/browser-data/hash.txt'),
        ).resolves.toMatch(/^[0-9a-f]{8}$/);
        await expect(
            fileHelpers.getFileMD5('/browser-data/missing.txt'),
        ).resolves.toBeNull();
        expect(handleErrorMock).toHaveBeenCalledWith(expect.any(Error));

        vi.stubGlobal(
            'fetch',
            vi.fn(async () => ({
                blob: async () => new Blob(['hello'], { type: 'text/plain' }),
            })),
        );
        await expect(fileHelpers.getFileBase64('/remote')).resolves.toMatch(
            /^data:text\/plain;base64,/,
        );

        expect(appProvider.windowTitle).toBe('File Helpers');
        expect(appProvider.isPagePresenter).toBe(true);
        expect(appProvider.isMainPage).toBe(true);
        expect(appProvider.getIsMouseOverApp()).toBe(false);
        document.dispatchEvent(new Event('mouseenter'));
        expect(appProvider.getIsMouseOverApp()).toBe(true);
        document.dispatchEvent(new Event('mouseleave'));
        expect(appProvider.getIsMouseOverApp()).toBe(false);
        vi.spyOn(document, 'hasFocus').mockReturnValue(true);
        expect(appProvider.getIsWindowFocused()).toBe(true);
    });

    test('normalizes the root path and rejects unknown mimetypes', async () => {
        const { fileHelpers } = await loadModules();

        // the resolved root ends with the separator and is trimmed away
        expect(fileHelpers.pathResolve('/')).toBe('');
        expect(fileHelpers.getFileMetaData('archive.unknownext')).toBeNull();
    });

    test('exposes read and write streams for a path', async () => {
        const { fileHelpers } = await loadModules();
        const filePath = '/browser-data/streams/note.txt';

        await fileHelpers.fsCreateDir('/browser-data/streams');

        const writeStream = fileHelpers.fsCreateWriteStream(filePath);
        const closePromise = new Promise<void>((resolve) => {
            writeStream.once('close', resolve);
        });
        writeStream.write('streamed');
        writeStream.end();
        await closePromise;

        expect(await fileHelpers.fsReadFile(filePath)).toBe('streamed');
        expect(fileHelpers.fsCreateReadStream(filePath)).toBeDefined();
    });

    test('existence checks short-circuit and surface unexpected stat errors', async () => {
        const { fileHelpers, appProvider } = await loadModules();

        expect(await fileHelpers.fsCheckDirExist('')).toBe(false);
        expect(await fileHelpers.fsCheckFileExist('')).toBe(false);

        // a non-ENOENT failure is a real problem, not a missing file
        const statError: any = new Error('permission denied');
        statError.code = 'EACCES';
        vi.spyOn(appProvider.fileUtils, 'stat').mockImplementation(((
            _filePath: string,
            callback: (error: any) => void,
        ) => {
            callback(statError);
        }) as any);

        await expect(
            fileHelpers.fsCheckFileExist('/browser-data/locked.txt'),
        ).rejects.toThrow('Error during checking file exist');
        expect(handleErrorMock).toHaveBeenCalledWith(statError);
    });

    test('reads a file size and refuses directories', async () => {
        const { fileHelpers, appProvider } = await loadModules();
        const dirPath = '/browser-data/sizes';

        await fileHelpers.fsCreateDir(dirPath);
        await expect(fileHelpers.fsGetFileSize(dirPath)).rejects.toThrow(
            'Path is not a file',
        );

        vi.spyOn(appProvider.fileUtils, 'stat').mockImplementation(((
            _filePath: string,
            callback: (error: any, stat: any) => void,
        ) => {
            callback(null, {
                isFile: () => true,
                isDirectory: () => false,
                size: 42,
            });
        }) as any);
        await expect(
            fileHelpers.fsGetFileSize(`${dirPath}/note.txt`),
        ).resolves.toBe(42);
    });

    test('listing helpers tolerate an empty directory path and listing errors', async () => {
        const { fileHelpers, appProvider } = await loadModules();

        expect(await fileHelpers.fsList('')).toEqual([]);
        expect(await fileHelpers.fsListFilesWithMimetype('', 'image')).toEqual(
            [],
        );

        vi.spyOn(appProvider.fileUtils, 'readdir').mockImplementation(((
            _dirPath: string,
            callback: (error: any) => void,
        ) => {
            callback(new Error('cannot read directory'));
        }) as any);
        await expect(
            fileHelpers.fsListFilesWithMimetype(
                '/browser-data/missing',
                'image',
            ),
        ).resolves.toBeNull();
        expect(handleErrorMock).toHaveBeenCalledWith(expect.any(Error));
        expect(showSimpleToastMock).toHaveBeenCalledWith(
            'Getting File List',
            'Error occurred during listing file',
        );
    });

    test('rename, delete, and unlink guard against the wrong kind of path', async () => {
        const { fileHelpers } = await loadModules();
        const baseDir = '/browser-data/guards';

        await fileHelpers.fsCreateDir(baseDir);
        await fileHelpers.fsCreateFile(`${baseDir}/one.txt`, 'one');
        await fileHelpers.fsCreateFile(`${baseDir}/two.txt`, 'two');
        await fileHelpers.fsCreateDir(`${baseDir}/folder`);

        await expect(
            fileHelpers.fsRenameFile(baseDir, 'missing.txt', 'other.txt'),
        ).rejects.toThrow('File not exist');
        await expect(
            fileHelpers.fsRenameFile(baseDir, 'one.txt', 'two.txt'),
        ).rejects.toThrow('File exist');

        await expect(
            fileHelpers.fsDeleteFile(`${baseDir}/folder`),
        ).rejects.toThrow(`${baseDir}/folder is not a file`);
        await expect(
            fileHelpers.fsDeleteDir(`${baseDir}/one.txt`),
        ).rejects.toThrow(`${baseDir}/one.txt is not a directory`);

        // deleting something already gone is a no-op
        await expect(
            fileHelpers.fsDeleteFile(`${baseDir}/missing.txt`),
        ).resolves.toBeUndefined();

        fileHelpers.fsUnlinkSync(`${baseDir}/two.txt`);
        expect(fileHelpers.fsExistSync(`${baseDir}/two.txt`)).toBe(false);
    });

    test('copies an uploaded File using its own name', async () => {
        const { fileHelpers } = await loadModules();
        const copyDir = '/browser-data/uploads';

        await fileHelpers.fsCreateDir(copyDir);
        const uploadedFile = createUploadFile('alpha', 'upload.txt');

        await expect(
            fileHelpers.fsCopyFilePathToPath(uploadedFile, copyDir),
        ).resolves.toBe(`${copyDir}/upload.txt`);
        expect(await fileHelpers.fsReadFile(`${copyDir}/upload.txt`)).toBe(
            'alpha',
        );
    });

    test('clones an uploaded File through the write stream', async () => {
        const { fileHelpers } = await loadModules();
        const destDir = '/browser-data/clones';

        await fileHelpers.fsCreateDir(destDir);
        const file = createUploadFile('cloned content', 'clone.txt');

        await fileHelpers.fsCloneFile(file, `${destDir}/clone.txt`);

        expect(await fileHelpers.fsReadFile(`${destDir}/clone.txt`)).toBe(
            'cloned content',
        );
    });

    test('clone honors backpressure, disk errors, and aborted sources', async () => {
        const { fileHelpers, appProvider } = await loadModules();
        const destPath = '/browser-data/clones/stub.txt';

        function createStubWriteStream() {
            const listeners = new Map<string, ((...args: any[]) => void)[]>();
            const stream: any = {
                writtenChunks: [] as unknown[],
                isEnded: false,
                isDestroyed: false,
                // when the next write should report a full buffer
                pendingWriteResults: [] as boolean[],
                errorOnWrite: null as Error | null,
                on(event: string, listener: (...args: any[]) => void) {
                    listeners.set(event, [
                        ...(listeners.get(event) ?? []),
                        listener,
                    ]);
                    return stream;
                },
                once(event: string, listener: (...args: any[]) => void) {
                    return stream.on(event, listener);
                },
                emit(event: string, ...args: unknown[]) {
                    for (const listener of [...(listeners.get(event) ?? [])]) {
                        listener(...args);
                    }
                },
                write(chunk: unknown) {
                    stream.writtenChunks.push(chunk);
                    if (stream.errorOnWrite !== null) {
                        stream.emit('error', stream.errorOnWrite);
                    }
                    const result = stream.pendingWriteResults.length
                        ? stream.pendingWriteResults.shift()
                        : true;
                    if (result === false) {
                        queueMicrotask(() => {
                            stream.emit('drain');
                        });
                    }
                    return result;
                },
                end() {
                    stream.isEnded = true;
                    stream.emit('close');
                },
                destroy() {
                    stream.isDestroyed = true;
                },
            };
            return stream;
        }

        let stubStream = createStubWriteStream();
        vi.spyOn(appProvider.fileUtils, 'createWriteStream').mockImplementation(
            (() => {
                return stubStream;
            }) as any,
        );

        // a full write buffer makes the source wait for 'drain'
        stubStream.pendingWriteResults.push(false);
        await fileHelpers.fsCloneFile(
            createUploadFile('backpressure', 'a.txt'),
            destPath,
        );
        expect(stubStream.isEnded).toBe(true);
        expect(stubStream.isDestroyed).toBe(false);

        // a disk error settles the clone exactly once, even when the stream
        // keeps emitting afterwards
        stubStream = createStubWriteStream();
        const diskError = new Error('disk full');
        stubStream.errorOnWrite = diskError;
        await expect(
            fileHelpers.fsCloneFile(
                createUploadFile('boom', 'b.txt'),
                destPath,
            ),
        ).rejects.toThrow('disk full');
        expect(stubStream.isDestroyed).toBe(true);
        stubStream.emit('error', diskError);
        stubStream.emit('close');

        // a source that fails mid-read aborts the destination
        stubStream = createStubWriteStream();
        const abortedFile = createUploadFile('x', 'c.txt');
        Object.defineProperty(abortedFile, 'stream', {
            configurable: true,
            value: () => {
                return new ReadableStream({
                    start(controller) {
                        controller.error(new Error('source failed'));
                    },
                });
            },
        });
        await expect(
            fileHelpers.fsCloneFile(abortedFile, destPath),
        ).rejects.toThrow('source failed');
        expect(stubStream.isDestroyed).toBe(true);
    });

    test('base64 conversion reports reader and network failures', async () => {
        const { fileHelpers } = await loadModules();

        vi.stubGlobal(
            'fetch',
            vi.fn(async () => ({
                blob: async () => new Blob(['hello'], { type: 'text/plain' }),
            })),
        );
        vi.stubGlobal(
            'FileReader',
            class {
                onloadend: (() => void) | null = null;
                onerror: ((error: unknown) => void) | null = null;
                result: string | null = null;
                readAsDataURL() {
                    this.onerror?.('boom');
                }
            },
        );
        await expect(fileHelpers.getFileBase64('/remote')).rejects.toThrow(
            'Error reading blob as base64: boom',
        );

        vi.stubGlobal(
            'fetch',
            vi.fn(async () => {
                throw new Error('offline');
            }),
        );
        await expect(fileHelpers.getFileBase64('/remote')).rejects.toThrow(
            'offline',
        );
    });
});
