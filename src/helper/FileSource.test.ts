import { beforeEach, describe, expect, test, vi } from 'vitest';

import { DragTypeEnum } from './DragInf';

const {
    state,
    showSimpleToastMock,
    handleErrorMock,
    getColorNoteMock,
    setColorNoteMock,
    dirSourceGetInstanceByDirPathMock,
    electronSendAsyncMock,
    showProgressBarMock,
    hideProgressBarMock,
    pathToFileURLMock,
    unlockingMock,
} = vi.hoisted(() => {
    return {
        state: {
            files: new Map<string, string>(),
            existingPaths: new Set<string>(),
            metadataByName: new Map<string, any>(),
            readErrors: new Map<string, Error>(),
            writeErrors: new Map<string, Error>(),
            renameErrors: new Map<string, Error>(),
            cloneErrors: new Map<string, Error>(),
            base64WriteErrors: new Map<string, Error>(),
            callbackReadData: new Map<string, string>(),
            callbackReadErrors: new Map<string, Error>(),
            dirSources: new Map<
                string,
                { fireRefreshEvent: ReturnType<typeof vi.fn> }
            >(),
            isWindows: false,
        },
        showSimpleToastMock: vi.fn(),
        handleErrorMock: vi.fn(),
        getColorNoteMock: vi.fn(),
        setColorNoteMock: vi.fn(),
        dirSourceGetInstanceByDirPathMock: vi.fn(),
        electronSendAsyncMock: vi.fn(),
        showProgressBarMock: vi.fn(),
        hideProgressBarMock: vi.fn(),
        pathToFileURLMock: vi.fn(),
        unlockingMock: vi.fn(),
    };
});

function normalizePath(...parts: string[]) {
    let normalizedPath = parts.join('/').replaceAll('\\', '/');
    while (normalizedPath.includes('//')) {
        normalizedPath = normalizedPath.replaceAll('//', '/');
    }
    return normalizedPath;
}

function resetState() {
    state.files.clear();
    state.existingPaths.clear();
    state.metadataByName.clear();
    state.readErrors.clear();
    state.writeErrors.clear();
    state.renameErrors.clear();
    state.cloneErrors.clear();
    state.base64WriteErrors.clear();
    state.callbackReadData.clear();
    state.callbackReadErrors.clear();
    state.dirSources.clear();
    state.isWindows = false;

    vi.clearAllMocks();
    vi.unstubAllGlobals();

    getColorNoteMock.mockResolvedValue(null);
    setColorNoteMock.mockReturnValue(undefined);
    electronSendAsyncMock.mockResolvedValue(true);
    pathToFileURLMock.mockImplementation((filePath: string) => {
        return `file-url:${filePath}`;
    });
    unlockingMock.mockImplementation(
        async (_key: string, callback: () => unknown) => {
            return await callback();
        },
    );
    dirSourceGetInstanceByDirPathMock.mockImplementation((dirPath: string) => {
        if (!state.dirSources.has(dirPath)) {
            state.dirSources.set(dirPath, {
                fireRefreshEvent: vi.fn(),
            });
        }
        return state.dirSources.get(dirPath);
    });
}

function setFile(filePath: string, data = '') {
    const normalizedPath = normalizePath(filePath);
    state.existingPaths.add(normalizedPath);
    state.files.set(normalizedPath, data);
}

async function loadFileSourceModule() {
    vi.resetModules();
    return await import('./FileSource');
}

async function flushEvents() {
    await Promise.resolve();
    await Promise.resolve();
}

vi.mock('../server/fileHelpers', () => ({
    checkIsAppFile: (fileFullName: string) => fileFullName.endsWith('.owa'),
    getFileDotExtension: (fileFullName: string) => {
        return fileFullName.substring(fileFullName.lastIndexOf('.'));
    },
    fsCheckFileExist: vi.fn(async (...parts: string[]) => {
        return state.existingPaths.has(normalizePath(...parts));
    }),
    fsCreateFile: vi.fn(async (filePath: string, data: string) => {
        const normalizedPath = normalizePath(filePath);
        state.existingPaths.add(normalizedPath);
        state.files.set(normalizedPath, data);
        return normalizedPath;
    }),
    fsReadFile: vi.fn(async (filePath: string) => {
        const normalizedPath = normalizePath(filePath);
        const error = state.readErrors.get(normalizedPath);
        if (error) {
            throw error;
        }
        return state.files.get(normalizedPath) ?? '';
    }),
    fsRenameFile: vi.fn(
        async (baseDirPath: string, fullName: string, newFullName: string) => {
            const oldPath = normalizePath(baseDirPath, fullName);
            const newPath = normalizePath(baseDirPath, newFullName);
            const error = state.renameErrors.get(oldPath);
            if (error) {
                throw error;
            }
            const oldData = state.files.get(oldPath);
            state.existingPaths.delete(oldPath);
            state.files.delete(oldPath);
            state.existingPaths.add(newPath);
            if (oldData !== undefined) {
                state.files.set(newPath, oldData);
            }
        },
    ),
    fsWriteFile: vi.fn(async (filePath: string, data: string) => {
        const normalizedPath = normalizePath(filePath);
        const error = state.writeErrors.get(normalizedPath);
        if (error) {
            throw error;
        }
        state.existingPaths.add(normalizedPath);
        state.files.set(normalizedPath, data);
    }),
    getFileMetaData: (fileFullName: string) => {
        return state.metadataByName.get(fileFullName) ?? null;
    },
    pathBasename: (filePath: string) => {
        return normalizePath(filePath).split('/').at(-1) ?? '';
    },
    pathJoin: (...paths: string[]) => normalizePath(...paths),
    pathSeparator: '/',
    getFileName: (fileFullName: string) => {
        return fileFullName.substring(0, fileFullName.lastIndexOf('.'));
    },
    writeFileFromBase64Sync: (filePath: string, srcData: string) => {
        const normalizedPath = normalizePath(filePath);
        const error = state.base64WriteErrors.get(normalizedPath);
        if (error) {
            throw error;
        }
        state.existingPaths.add(normalizedPath);
        state.files.set(normalizedPath, srcData);
    },
    fsCloneFile: vi.fn(async (sourcePath: string, destPath: string) => {
        const normalizedSourcePath = normalizePath(sourcePath);
        const normalizedDestPath = normalizePath(destPath);
        const error = state.cloneErrors.get(normalizedSourcePath);
        if (error) {
            throw error;
        }
        state.existingPaths.add(normalizedDestPath);
        state.files.set(
            normalizedDestPath,
            state.files.get(normalizedSourcePath) ?? '',
        );
    }),
}));

vi.mock('./helpers', () => ({
    isValidJson: (value: string) => {
        try {
            JSON.parse(value);
            return true;
        } catch {
            return false;
        }
    },
}));

vi.mock('../server/calcHelpers', () => ({
    pathToFileURL: pathToFileURLMock,
}));

vi.mock('../server/appProvider', () => ({
    default: {
        fileUtils: {
            readFile: (
                filePath: string,
                _options: { encoding: string },
                callback: (error: Error | null, data?: string) => void,
            ) => {
                const normalizedPath = normalizePath(filePath);
                const error = state.callbackReadErrors.get(normalizedPath);
                if (error) {
                    callback(error);
                    return;
                }
                callback(
                    null,
                    state.callbackReadData.get(normalizedPath) ?? '',
                );
            },
        },
        systemUtils: {
            get isWindows() {
                return state.isWindows;
            },
        },
    },
}));

vi.mock('./DirSource', () => ({
    default: {
        getInstanceByDirPath: dirSourceGetInstanceByDirPathMock,
    },
}));

vi.mock('../toast/toastHelpers', () => ({
    showSimpleToast: showSimpleToastMock,
}));

vi.mock('./errorHelpers', () => ({
    handleError: handleErrorMock,
}));

vi.mock('./FileSourceMetaManager', () => ({
    default: {
        getColorNote: getColorNoteMock,
        setColorNote: setColorNoteMock,
    },
}));

vi.mock('../server/appHelpers', () => ({
    electronSendAsync: electronSendAsyncMock,
}));

vi.mock('../server/unlockingHelpers', () => ({
    unlocking: unlockingMock,
}));

vi.mock('../others/CacheManager', () => ({
    default: class CacheManager<T> {
        private readonly cache = new Map<string, T>();

        async get(key: string) {
            const value = this.cache.get(key);
            return value ?? null;
        }

        async set(key: string, value: T) {
            this.cache.set(key, value);
        }

        async delete(key: string) {
            this.cache.delete(key);
        }
    },
}));

vi.mock('../lang/langHelpers', () => ({
    tran: (value: string) => value,
}));

vi.mock('../progress-bar/progressBarHelpers', () => ({
    showProgressBar: showProgressBarMock,
    hideProgressBar: hideProgressBarMock,
}));

describe('FileSource', () => {
    beforeEach(() => {
        resetState();
    });

    test('exposes getters, cache helpers, drag data and color note hooks', async () => {
        state.metadataByName.set('song.txt', {
            appMimetype: { mimetypeSignatures: ['text/plain'] },
        });
        getColorNoteMock.mockResolvedValue('blue');

        const { default: FileSource } = await loadFileSourceModule();
        const fileSource = FileSource.getInstance('/docs/song.txt');
        const manualFileSource = FileSource.getInstanceNoCache(
            '/docs',
            'manual.txt',
        );

        expect(FileSource.toRWLockingKey('/docs/song.txt')).toBe(
            'rw-/docs/song.txt',
        );
        expect(FileSource.toDataCacheKey('/docs/song.txt')).toBe(
            'file-data-/docs/song.txt',
        );
        expect(FileSource.getInstance('/docs/song.txt')).toBe(fileSource);
        expect(fileSource.filePath).toBe('/docs/song.txt');
        expect(fileSource.src).toBe('file-url:/docs/song.txt');
        expect(fileSource.isAppFile).toBe(false);
        expect(fileSource.metadata).toEqual({
            appMimetype: { mimetypeSignatures: ['text/plain'] },
        });
        expect(fileSource.name).toBe('song');
        expect(fileSource.dotExtension).toBe('.txt');
        expect(fileSource.extension).toBe('txt');
        expect(fileSource.dirSource).toBe(state.dirSources.get('/docs'));
        expect(await fileSource.getColorNote()).toBe('blue');
        await fileSource.setColorNote('red');
        expect(setColorNoteMock).toHaveBeenCalledWith('/docs/song.txt', 'red');
        expect(
            state.dirSources.get('/docs')?.fireRefreshEvent,
        ).toHaveBeenCalledTimes(1);

        manualFileSource.name = 'draft';
        expect(manualFileSource.fullName).toBe('draft.txt');

        expect(fileSource.dragSerialize(DragTypeEnum.SLIDE)).toEqual({
            type: DragTypeEnum.SLIDE,
            data: '/docs/song.txt',
        });
        expect(fileSource.dragSerialize()).toEqual({
            type: DragTypeEnum.UNKNOWN,
            data: '/docs/song.txt',
        });

        const refreshedInstance = FileSource.getInstance(
            '/docs/song.txt',
            undefined,
            true,
        );
        expect(refreshedInstance).not.toBe(fileSource);
        expect(FileSource.dragDeserialize('/docs/song.txt')).toBe(
            refreshedInstance,
        );
    });

    test('builds src data and rejects missing metadata or read errors', async () => {
        state.callbackReadData.set('/docs/photo.png', 'YWJj');
        state.metadataByName.set('photo.png', {
            appMimetype: { mimetypeSignatures: ['image/png'] },
        });
        state.callbackReadData.set('/docs/no-meta.bin', 'AA==');
        state.callbackReadErrors.set(
            '/docs/broken.png',
            new Error('read failed'),
        );
        state.metadataByName.set('broken.png', {
            appMimetype: { mimetypeSignatures: ['image/png'] },
        });

        const { default: FileSource } = await loadFileSourceModule();

        await expect(
            FileSource.getInstance('/docs/photo.png').getSrcData(),
        ).resolves.toBe('data:image/png;base64,YWJj');
        await expect(
            FileSource.getInstance('/docs/no-meta.bin').getSrcData(),
        ).rejects.toThrow('metadata not found');
        await expect(
            FileSource.getInstance('/docs/broken.png').getSrcData(),
        ).rejects.toThrow('read failed');
    });

    test('reads text and json data with caching, BOM trimming and toast handling', async () => {
        setFile('/docs/data.json', `\uFEFF${JSON.stringify({ ok: 1 })}`);
        setFile('/docs/bad.json', '{bad json');
        state.readErrors.set('/docs/error.txt', new Error('boom'));
        state.readErrors.set('/docs/silent.txt', new Error('quiet'));
        state.existingPaths.add('/docs/error.txt');
        state.existingPaths.add('/docs/silent.txt');

        const { default: FileSource } = await loadFileSourceModule();
        const firstRead = await FileSource.readFileData('/docs/data.json');
        state.files.set('/docs/data.json', JSON.stringify({ ok: 2 }));

        expect(firstRead).toBe(JSON.stringify({ ok: 1 }));
        expect(await FileSource.readFileData('/docs/data.json')).toBe(
            JSON.stringify({ ok: 1 }),
        );
        expect(
            await FileSource.getInstance('/docs/data.json').readFileJsonData(),
        ).toEqual({ ok: 1 });
        expect(
            await FileSource.getInstance('/docs/bad.json').readFileJsonData(),
        ).toBeNull();
        expect(
            await FileSource.getInstance('/docs/missing.txt').readFileData(),
        ).toBeNull();

        expect(await FileSource.readFileData('/docs/error.txt')).toBeNull();
        expect(showSimpleToastMock).toHaveBeenCalledWith(
            'Reader File Data',
            'Error occurred during reading file: "/docs/error.txt", error: boom',
        );

        showSimpleToastMock.mockClear();
        expect(
            await FileSource.readFileData('/docs/silent.txt', true),
        ).toBeNull();
        expect(showSimpleToastMock).not.toHaveBeenCalled();
    });

    test('writes text and base64 data and reports save failures', async () => {
        setFile('/docs/cached.txt', 'old');
        setFile('/docs/fail.txt', 'before');
        state.writeErrors.set('/docs/fail.txt', new Error('cannot save'));
        state.base64WriteErrors.set(
            '/docs/base64-fail.txt',
            new Error('bad base64'),
        );

        const { default: FileSource } = await loadFileSourceModule();
        const cachedFile = FileSource.getInstance('/docs/cached.txt');

        expect(await FileSource.readFileData('/docs/cached.txt')).toBe('old');
        expect(await cachedFile.writeFileData('new')).toBe(true);
        expect(state.files.get('/docs/cached.txt')).toBe('new');
        expect(await FileSource.readFileData('/docs/cached.txt')).toBe('new');

        expect(
            await FileSource.getInstance('/docs/new.txt').writeFileData(
                'created',
            ),
        ).toBe(true);
        expect(state.files.get('/docs/new.txt')).toBe('created');

        expect(
            await FileSource.writeFilePlainText('/docs/plain.txt', 'plain'),
        ).toBe(true);
        expect(state.files.get('/docs/plain.txt')).toBe('plain');

        expect(
            await FileSource.writeFileBase64Data(
                '/docs/base64.txt',
                'data:text/plain;base64,QQ==',
            ),
        ).toBe(true);
        expect(state.files.get('/docs/base64.txt')).toBe(
            'data:text/plain;base64,QQ==',
        );

        expect(
            FileSource.getInstance(
                '/docs/base64-fail.txt',
            ).writeFileBase64DataSync('data:text/plain;base64,QQ=='),
        ).toBe(false);
        expect(handleErrorMock).toHaveBeenCalledWith(
            expect.objectContaining({ message: 'bad base64' }),
        );

        expect(
            await FileSource.getInstance('/docs/fail.txt').writeFileData(
                'nope',
            ),
        ).toBe(false);
        expect(showSimpleToastMock).toHaveBeenCalledWith(
            'Saving File',
            'cannot save',
        );
    });

    test('resolves instances from src URLs and renames files', async () => {
        state.isWindows = true;
        setFile('C:/docs/my file.txt', 'value');
        setFile('/docs/old.txt', 'old');
        setFile('/docs/bad.txt', 'bad');
        state.renameErrors.set('/docs/bad.txt', new Error('rename failed'));

        const { default: FileSource } = await loadFileSourceModule();

        expect(
            await FileSource.getInstanceBySrc('file:///C:/docs/my%20file.txt'),
        ).toMatchObject({ filePath: 'C:/docs/my file.txt' });
        expect(
            await FileSource.getInstanceBySrc('file:///C:/docs/missing.txt'),
        ).toBeNull();

        const fileSource = FileSource.getInstance('/docs/old.txt');
        expect(await fileSource.renameTo('old')).toBeNull();

        const renamedFile = await fileSource.renameTo('renamed');
        expect(renamedFile?.filePath).toBe('/docs/renamed.txt');
        expect(state.files.get('/docs/renamed.txt')).toBe('old');

        expect(
            await FileSource.getInstance('/docs/bad.txt').renameTo('worse'),
        ).toBeNull();
        expect(handleErrorMock).toHaveBeenCalledWith(
            expect.objectContaining({ message: 'rename failed' }),
        );
        expect(showSimpleToastMock).toHaveBeenCalledWith(
            'Renaming File',
            'Unable to rename file: rename failed',
        );
    });

    test('duplicates files and finds the next available file path', async () => {
        setFile('/docs/report.txt', 'report');
        setFile('/docs/report (1).txt', 'existing');
        setFile('/docs/report (Copy).txt', 'copy');
        setFile('/docs/report (Copy 1).txt', 'copy1');
        setFile('/docs/fail.txt', 'broken');
        state.cloneErrors.set('/docs/fail.txt', new Error('clone failed'));

        const { default: FileSource } = await loadFileSourceModule();
        const reportFile = FileSource.getInstance('/docs/report.txt');

        expect(await reportFile.genNextFilePath()).toBe('/docs/report (2).txt');

        await reportFile.duplicate();
        expect(state.files.get('/docs/report (Copy 2).txt')).toBe('report');

        await FileSource.getInstance('/docs/fail.txt').duplicate();
        expect(showSimpleToastMock).toHaveBeenCalledWith(
            'Duplicating File',
            'Unable to duplicate file',
        );
        expect(handleErrorMock).toHaveBeenCalledWith(
            expect.objectContaining({ message: 'clone failed' }),
        );
    });

    test('emits generic and file-scoped events', async () => {
        const { default: FileSource } = await loadFileSourceModule();
        const genericListener = vi.fn();
        const scopedListener = vi.fn();
        const fileSource = FileSource.getInstance('/docs/item.txt');

        const genericEvents = FileSource.registerFileSourceEventListener(
            ['select', 'update', 'delete'],
            genericListener,
        );
        FileSource.registerFileSourceEventListener(
            ['update', 'delete'],
            scopedListener,
            '/docs/item.txt',
        );

        fileSource.fireSelectEvent('selected');
        fileSource.fireUpdateEvent({ changed: true });
        fileSource.fireDeleteEvent();
        await flushEvents();

        expect(genericListener.mock.calls).toEqual([
            ['selected', expect.any(Number)],
            [{ changed: true }, expect.any(Number)],
            ['/docs/item.txt', expect.any(Number)],
        ]);
        expect(scopedListener.mock.calls).toEqual([
            [{ changed: true }, expect.any(Number)],
            ['/docs/item.txt', expect.any(Number)],
        ]);

        FileSource.unregisterEventListener(genericEvents);
        fileSource.fireUpdateEvent('after-unregister');
        await flushEvents();

        expect(genericListener.mock.calls).toHaveLength(3);
        expect(scopedListener.mock.calls.at(-1)).toEqual([
            'after-unregister',
            expect.any(Number),
        ]);
    });

    test('trashes files with progress feedback and delete events', async () => {
        const { default: FileSource } = await loadFileSourceModule();
        const deleteListener = vi.fn();
        const trashFile = FileSource.getInstance('/docs/trash.txt');
        const failedTrashFile = FileSource.getInstance('/docs/trash-fail.txt');

        FileSource.registerFileSourceEventListener(
            ['delete'],
            deleteListener,
            '/docs/trash.txt',
        );
        electronSendAsyncMock
            .mockResolvedValueOnce(true)
            .mockResolvedValueOnce(false);

        await trashFile.trash();
        await flushEvents();

        expect(showProgressBarMock).toHaveBeenCalledWith(
            'trash-file-/docs/trash.txt',
        );
        expect(hideProgressBarMock).toHaveBeenCalledWith(
            'trash-file-/docs/trash.txt',
        );
        expect(electronSendAsyncMock).toHaveBeenCalledWith(
            'main:app:trash-path',
            {
                path: '/docs/trash.txt',
            },
        );
        expect(deleteListener).toHaveBeenCalledWith(
            '/docs/trash.txt',
            expect.any(Number),
        );

        await failedTrashFile.trash();

        expect(showSimpleToastMock).toHaveBeenCalledWith(
            'Trashing File',
            'Unable to trash file. Please try again.',
        );
    });

    test('reads src data from blobs through FileReader', async () => {
        const { default: FileSource } = await loadFileSourceModule();
        let fileReaderShouldFail = false;

        class FileReaderMock {
            result: string | null = null;
            onload: null | (() => void) = null;
            onerror: null | (() => void) = null;

            readAsDataURL(file: Blob) {
                if (fileReaderShouldFail) {
                    this.onerror?.();
                    return;
                }
                this.result = `data:${file.type};base64,ZmFrZQ==`;
                this.onload?.();
            }
        }

        vi.stubGlobal(
            'FileReader',
            FileReaderMock as unknown as typeof FileReader,
        );

        await expect(
            FileSource.getSrcDataFromFrom(
                new Blob(['fake'], { type: 'text/plain' }),
            ),
        ).resolves.toBe('data:text/plain;base64,ZmFrZQ==');

        fileReaderShouldFail = true;

        await expect(
            FileSource.getSrcDataFromFrom(
                new Blob(['fake'], { type: 'text/plain' }),
            ),
        ).resolves.toBeNull();
    });
});
