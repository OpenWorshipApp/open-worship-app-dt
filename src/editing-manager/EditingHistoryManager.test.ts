import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => {
    const files = new Map<string, string>();
    const dirs = new Set<string>();
    const fileSources = new Map<string, any>();

    const normalizePath = (filePath: string) => {
        return filePath.replaceAll('\\', '/');
    };

    const getDirName = (filePath: string) => {
        const normalizedPath = normalizePath(filePath);
        const index = normalizedPath.lastIndexOf('/');
        return index === -1 ? '' : normalizedPath.substring(0, index);
    };

    const ensureParentDir = (filePath: string) => {
        const dirPath = getDirName(filePath);
        if (dirPath) {
            dirs.add(dirPath);
        }
    };

    const getFileSource = (filePath: string) => {
        const normalizedPath = normalizePath(filePath);
        if (!fileSources.has(normalizedPath)) {
            fileSources.set(normalizedPath, {
                fireUpdateEvent: vi.fn(),
                readFileData: vi.fn(async () => {
                    return files.get(normalizedPath) ?? null;
                }),
                writeFileData: vi.fn(async (data: string) => {
                    ensureParentDir(normalizedPath);
                    files.set(normalizedPath, data);
                    return true;
                }),
            });
        }
        return fileSources.get(normalizedPath);
    };

    const resetFs = () => {
        files.clear();
        dirs.clear();
        fileSources.clear();
    };

    return {
        dirs,
        files,
        getDirName,
        getFileSource,
        handleErrorMock: vi.fn(),
        normalizePath,
        resetFs,
        unlockingMock: vi.fn(
            async (_key: string, callback: () => Promise<unknown>) => {
                return await callback();
            },
        ),
    };
});

vi.mock('../helper/errorHelpers', () => ({
    handleError: mocks.handleErrorMock,
}));

vi.mock('../server/unlockingHelpers', () => ({
    unlocking: mocks.unlockingMock,
}));

vi.mock('../server/fileHelpers', () => ({
    fsCheckDirExist: vi.fn(async (dirPath: string) => {
        return mocks.dirs.has(mocks.normalizePath(dirPath));
    }),
    fsCheckFileExist: vi.fn(async (filePath: string) => {
        return mocks.files.has(mocks.normalizePath(filePath));
    }),
    fsCloneFile: vi.fn(async (sourcePath: string, targetPath: string) => {
        const normalizedSource = mocks.normalizePath(sourcePath);
        const normalizedTarget = mocks.normalizePath(targetPath);
        mocks.dirs.add(mocks.getDirName(normalizedTarget));
        mocks.files.set(
            normalizedTarget,
            mocks.files.get(normalizedSource) ?? '',
        );
    }),
    fsCreateDir: vi.fn(async (dirPath: string) => {
        mocks.dirs.add(mocks.normalizePath(dirPath));
    }),
    fsDeleteDir: vi.fn(async (dirPath: string) => {
        const normalizedDirPath = mocks.normalizePath(dirPath);
        mocks.dirs.delete(normalizedDirPath);
        for (const filePath of [...mocks.files.keys()]) {
            if (
                filePath === normalizedDirPath ||
                filePath.startsWith(`${normalizedDirPath}/`)
            ) {
                mocks.files.delete(filePath);
            }
        }
    }),
    fsDeleteFile: vi.fn(async (filePath: string) => {
        mocks.files.delete(mocks.normalizePath(filePath));
    }),
    fsListFiles: vi.fn(async (dirPath: string) => {
        const normalizedDirPath = mocks.normalizePath(dirPath);
        return [...mocks.files.keys()]
            .filter((filePath) => {
                return filePath.startsWith(`${normalizedDirPath}/`);
            })
            .map((filePath) => {
                return filePath.substring(normalizedDirPath.length + 1);
            });
    }),
    fsMove: vi.fn(async (oldPath: string, newPath: string) => {
        const normalizedOldPath = mocks.normalizePath(oldPath);
        const normalizedNewPath = mocks.normalizePath(newPath);
        if (mocks.files.has(normalizedOldPath)) {
            const data = mocks.files.get(normalizedOldPath) ?? '';
            mocks.files.delete(normalizedOldPath);
            mocks.dirs.add(mocks.getDirName(normalizedNewPath));
            mocks.files.set(normalizedNewPath, data);
            return normalizedNewPath;
        }

        const movedEntries = [...mocks.files.entries()].filter(([filePath]) => {
            return filePath.startsWith(`${normalizedOldPath}/`);
        });
        if (movedEntries.length > 0 || mocks.dirs.has(normalizedOldPath)) {
            mocks.dirs.delete(normalizedOldPath);
            mocks.dirs.add(normalizedNewPath);
            for (const [filePath, data] of movedEntries) {
                const suffix = filePath.substring(normalizedOldPath.length);
                mocks.files.delete(filePath);
                mocks.files.set(`${normalizedNewPath}${suffix}`, data);
            }
            return normalizedNewPath;
        }

        return normalizedNewPath;
    }),
    pathBasename: vi.fn((filePath: string) => {
        return mocks.normalizePath(filePath).split('/').at(-1) ?? filePath;
    }),
    pathJoin: vi.fn((...parts: string[]) => {
        return parts.map((part) => mocks.normalizePath(part)).join('/');
    }),
}));

vi.mock('../helper/FileSource', () => ({
    default: {
        getInstance: vi.fn((filePath: string) => {
            return mocks.getFileSource(filePath);
        }),
        readFileData: vi.fn(async (filePath: string) => {
            return mocks.files.get(mocks.normalizePath(filePath)) ?? null;
        }),
        writeFilePlainText: vi.fn(async (filePath: string, data: string) => {
            const normalizedPath = mocks.normalizePath(filePath);
            const dirPath = mocks.getDirName(normalizedPath);
            if (dirPath) {
                mocks.dirs.add(dirPath);
            }
            mocks.files.set(normalizedPath, data);
            return true;
        }),
    },
}));

async function loadEditingHistoryModule() {
    return await import('./EditingHistoryManager');
}

// the mocked modules are re-instantiated by the `vi.resetModules()` in
// `beforeEach`, so a test that overrides one must grab it from the same
// registry generation as the module under test
async function loadMockedModules() {
    const [{ default: FileSource }, fileHelpers] = await Promise.all([
        import('../helper/FileSource'),
        import('../server/fileHelpers'),
    ]);
    return { FileSource: FileSource as any, fileHelpers: fileHelpers as any };
}

describe('EditingHistoryManager', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        mocks.resetFs();
    });

    test('creates history directories and navigates revision files', async () => {
        const filePath = '/docs/song.owa';
        const historyDirPath = `${filePath}.histories`;
        mocks.dirs.add('/docs');
        mocks.files.set(filePath, 'version 1');

        const { FileLineHandler } = await loadEditingHistoryModule();
        const handler = new FileLineHandler(filePath, historyDirPath);

        await handler.ensureHistoriesDir();

        expect(mocks.dirs.has(historyDirPath)).toBe(true);
        expect(await handler.getCurrentFileFullPath()).toBe(
            `${historyDirPath}/0-head`,
        );
        expect(await handler.getAllFileIndices()).toEqual([0]);
        expect(await handler.getPreviousFileFullPath()).toBeNull();
        expect(await handler.getNextFileFullPath()).toBeNull();

        const missingHandler = new FileLineHandler(
            '/docs/missing.owa',
            '/docs/missing.owa.histories',
        );

        await expect(missingHandler.ensureHistoriesDir()).rejects.toThrow(
            'File /docs/missing.owa does not exist',
        );
    });

    test('adds histories, clears redo states, supports undo redo, and discards histories', async () => {
        const filePath = '/docs/lyrics.owa';
        const historyDirPath = `${filePath}.histories`;
        mocks.dirs.add('/docs');
        mocks.files.set(filePath, 'version 1');

        const { default: EditingHistoryManager } =
            await loadEditingHistoryModule();
        const manager = new EditingHistoryManager(filePath);
        const fileSource = mocks.getFileSource(filePath);

        await manager.addHistory('version 2');
        await manager.addHistory('version 3');

        expect(await manager.getOriginalData()).toBe('version 1');
        expect(await manager.getCurrentHistory()).toBe('version 3');
        expect(await manager.checkCanUndo()).toBe(true);
        expect(await manager.checkCanRedo()).toBe(false);

        await manager.undo();

        expect(await manager.getCurrentHistory()).toBe('version 2');
        expect(await manager.checkCanRedo()).toBe(true);
        expect(fileSource.fireUpdateEvent).toHaveBeenLastCalledWith({
            isHistoryEditing: true,
            eventType: 'undo',
        });

        await manager.addHistory('version 4');

        expect(await manager.getCurrentHistory()).toBe('version 4');
        expect(await manager.checkCanRedo()).toBe(false);
        expect(mocks.files.has(`${historyDirPath}/2`)).toBe(false);

        await manager.undo();
        await manager.redo();

        expect(await manager.getCurrentHistory()).toBe('version 4');
        expect(fileSource.fireUpdateEvent).toHaveBeenLastCalledWith({
            isHistoryEditing: true,
            eventType: 'redo',
        });

        expect(await manager.discard()).toBe(true);
        expect(fileSource.fireUpdateEvent).toHaveBeenLastCalledWith({
            isHistoryEditing: true,
            eventType: 'discard',
        });
        expect(mocks.dirs.has(historyDirPath)).toBe(false);
        expect(await manager.checkCanUndo()).toBe(false);
        expect(await manager.checkCanRedo()).toBe(false);
    });

    test('saves current history, exposes cached instances, and moves history folders', async () => {
        const filePath = '/docs/notes.owa';
        const movedFilePath = '/moved/notes.owa';
        mocks.dirs.add('/docs');
        mocks.dirs.add('/moved');
        mocks.files.set(filePath, 'draft 1');

        const { default: EditingHistoryManager } =
            await loadEditingHistoryModule();
        const manager = EditingHistoryManager.getInstance(filePath);

        expect(EditingHistoryManager.getInstance(filePath)).toBe(manager);

        await manager.addHistory('draft 2');

        expect(await manager.save((data) => `${data} saved`)).toBe(true);
        expect(mocks.files.get(filePath)).toBe('draft 2 saved');
        expect(await manager.save(() => null)).toBe(false);

        await EditingHistoryManager.moveFilePath(filePath, movedFilePath);

        expect(mocks.dirs.has(`${movedFilePath}.histories`)).toBe(true);
        expect(mocks.files.has(`${movedFilePath}.histories/1-head`)).toBe(true);
    });

    test('recognizes the history movement event types', async () => {
        const { checkIsHistoryMovementEventType } =
            await loadEditingHistoryModule();

        expect(checkIsHistoryMovementEventType('undo')).toBe(true);
        expect(checkIsHistoryMovementEventType('redo')).toBe(true);
        expect(checkIsHistoryMovementEventType('discard')).toBe(true);
        expect(checkIsHistoryMovementEventType('save')).toBe(false);
        expect(checkIsHistoryMovementEventType(undefined)).toBe(false);
    });

    test('reports a listing failure only while the history folder still exists', async () => {
        const filePath = '/docs/listing.owa';
        const historyDirPath = `${filePath}.histories`;
        mocks.dirs.add('/docs');
        mocks.dirs.add(historyDirPath);
        mocks.files.set(filePath, 'version 1');

        const { FileLineHandler } = await loadEditingHistoryModule();
        const { fileHelpers } = await loadMockedModules();
        const handler = new FileLineHandler(filePath, historyDirPath);

        fileHelpers.fsListFiles.mockRejectedValueOnce(new Error('io failure'));
        expect(await handler.getCurrentFileFullPath()).toBeNull();
        expect(mocks.handleErrorMock).toHaveBeenCalledTimes(1);

        // a folder deleted mid-listing is an expected race, not an error
        fileHelpers.fsListFiles.mockImplementationOnce(async () => {
            mocks.dirs.delete(historyDirPath);
            throw new Error('io failure');
        });
        expect(await handler.getAllFileIndices()).toEqual([]);
        expect(mocks.handleErrorMock).toHaveBeenCalledTimes(1);

        // ...and a missing folder is never listed at all
        expect(await handler.getCurrentFileFullPath()).toBeNull();
        expect(fileHelpers.fsListFiles).toHaveBeenCalledTimes(2);
    });

    test('cleanupHistory drops the oldest revisions past the cap', async () => {
        const filePath = '/docs/big.owa';
        const historyDirPath = `${filePath}.histories`;
        mocks.dirs.add('/docs');
        mocks.dirs.add(historyDirPath);
        for (let index = 0; index < 100; index++) {
            mocks.files.set(`${historyDirPath}/${index}`, `v${index}`);
        }
        mocks.files.set(`${historyDirPath}/100-head`, 'v100');

        const { FileLineHandler } = await loadEditingHistoryModule();
        const { fileHelpers } = await loadMockedModules();
        const handler = new FileLineHandler(filePath, historyDirPath);

        await handler.cleanupHistory();

        // the sweep runs until the count drops back below the cap
        expect(mocks.files.has(`${historyDirPath}/0`)).toBe(false);
        expect(mocks.files.has(`${historyDirPath}/1`)).toBe(false);
        expect(mocks.files.size).toBe(99);

        // once back under the cap nothing else is removed
        await handler.cleanupHistory();
        expect(mocks.files.size).toBe(99);

        // a stale entry that no longer exists on disk stops the sweep
        mocks.files.set(`${historyDirPath}/0`, 'v0');
        fileHelpers.fsCheckFileExist.mockResolvedValueOnce(false);
        await handler.cleanupHistory();
        expect(mocks.files.has(`${historyDirPath}/0`)).toBe(true);

        // a delete failure is reported and stops the sweep
        fileHelpers.fsDeleteFile.mockRejectedValueOnce(new Error('locked'));
        await handler.cleanupHistory();
        expect(mocks.handleErrorMock).toHaveBeenCalledTimes(1);
        expect(mocks.files.has(`${historyDirPath}/0`)).toBe(true);
    });

    test('cleanupHistory stops when the oldest revision is the current one', async () => {
        const filePath = '/docs/head-first.owa';
        const historyDirPath = `${filePath}.histories`;
        mocks.dirs.add('/docs');
        mocks.dirs.add(historyDirPath);
        mocks.files.set(`${historyDirPath}/0-head`, 'v0');
        for (let index = 1; index <= 100; index++) {
            mocks.files.set(`${historyDirPath}/${index}`, `v${index}`);
        }

        const { FileLineHandler } = await loadEditingHistoryModule();
        const handler = new FileLineHandler(filePath, historyDirPath);

        await handler.cleanupHistory();

        expect(mocks.files.size).toBe(101);
    });

    test('appendHistory schedules a debounced cleanup', async () => {
        vi.useFakeTimers();
        try {
            const filePath = '/docs/debounced.owa';
            mocks.dirs.add('/docs');
            mocks.files.set(filePath, 'version 1');

            const { default: EditingHistoryManager } =
                await loadEditingHistoryModule();
            const manager = new EditingHistoryManager(filePath);
            const cleanupSpy = vi.spyOn(
                manager.fileLineHandler,
                'cleanupHistory',
            );

            await manager.addHistory('version 2');
            expect(cleanupSpy).not.toHaveBeenCalled();

            await vi.advanceTimersByTimeAsync(5000);
            expect(cleanupSpy).toHaveBeenCalledTimes(1);
        } finally {
            vi.useRealTimers();
        }
    });

    test('rollback refuses to run on missing or unusable revisions', async () => {
        const filePath = '/docs/rollback.owa';
        const historyDirPath = `${filePath}.histories`;
        mocks.dirs.add('/docs');
        mocks.files.set(filePath, 'version 1');

        const { FileLineHandler, default: EditingHistoryManager } =
            await loadEditingHistoryModule();
        const { FileSource } = await loadMockedModules();
        const emptyHandler = new FileLineHandler(filePath, historyDirPath);

        // no history folder at all
        expect(await emptyHandler.rollback(`${historyDirPath}/0`)).toBe(false);

        const manager = new EditingHistoryManager(filePath);
        await manager.addHistory('version 2');
        const previousFilePath =
            await manager.fileLineHandler.getPreviousFileFullPath();
        expect(previousFilePath).not.toBeNull();

        // the current revision cannot be read
        FileSource.readFileData.mockResolvedValueOnce(null);
        expect(await manager.fileLineHandler.rollback(previousFilePath!)).toBe(
            false,
        );

        // the patch file cannot be read
        FileSource.readFileData.mockResolvedValueOnce('version 2');
        FileSource.readFileData.mockResolvedValueOnce(null);
        expect(await manager.fileLineHandler.rollback(previousFilePath!)).toBe(
            false,
        );

        // the patch no longer applies to the current content
        mocks.files.set(
            `${historyDirPath}/1-head`,
            'totally unrelated content',
        );
        expect(await manager.fileLineHandler.rollback(previousFilePath!)).toBe(
            false,
        );
    });

    test('changeCurrent reports when no patch can be recorded', async () => {
        const filePath = '/docs/change.owa';
        const historyDirPath = `${filePath}.histories`;
        mocks.dirs.add('/docs');
        mocks.dirs.add(historyDirPath);
        mocks.files.set(filePath, 'version 1');
        mocks.files.set(`${historyDirPath}/5`, 'version 5');

        const { FileLineHandler } = await loadEditingHistoryModule();
        const { FileSource } = await loadMockedModules();
        const handler = new FileLineHandler(filePath, historyDirPath);

        // there was no current revision to diff against
        expect(await handler.changeCurrent(`${historyDirPath}/5`)).toBe(false);
        expect(mocks.files.has(`${historyDirPath}/5-head`)).toBe(true);

        mocks.files.set(`${historyDirPath}/6`, 'version 6');
        FileSource.readFileData.mockResolvedValueOnce(null);
        expect(await handler.changeCurrent(`${historyDirPath}/6`)).toBe(false);

        mocks.files.set(`${historyDirPath}/7`, 'version 7');
        FileSource.readFileData.mockResolvedValueOnce('version 6');
        FileSource.readFileData.mockResolvedValueOnce(null);
        expect(await handler.changeCurrent(`${historyDirPath}/7`)).toBe(false);
    });

    test('appendHistory reports failures instead of throwing', async () => {
        const filePath = '/docs/append.owa';
        const historyDirPath = `${filePath}.histories`;
        mocks.dirs.add('/docs');
        mocks.dirs.add(historyDirPath);
        mocks.files.set(filePath, 'version 1');

        const { FileLineHandler } = await loadEditingHistoryModule();
        const { FileSource } = await loadMockedModules();
        const handler = new FileLineHandler(filePath, historyDirPath);

        // no current revision yet
        expect(await handler.appendHistory('version 2')).toBe(false);

        mocks.files.set(`${historyDirPath}/0-head`, 'version 1');
        FileSource.writeFilePlainText.mockResolvedValueOnce(false);
        expect(await handler.appendHistory('version 2')).toBe(false);

        FileSource.writeFilePlainText.mockRejectedValueOnce(
            new Error('disk full'),
        );
        expect(await handler.appendHistory('version 2')).toBe(false);
        expect(mocks.handleErrorMock).toHaveBeenCalledTimes(1);
    });

    test('undo and redo stop at the ends of the history and on a failed rollback', async () => {
        const filePath = '/docs/edges.owa';
        mocks.dirs.add('/docs');
        mocks.files.set(filePath, 'version 1');

        const { default: EditingHistoryManager } =
            await loadEditingHistoryModule();
        const manager = new EditingHistoryManager(filePath);

        expect(await manager.undo()).toBe(false);
        expect(await manager.redo()).toBe(false);

        await manager.addHistory('version 2');
        const rollbackSpy = vi
            .spyOn(manager.fileLineHandler, 'rollback')
            .mockResolvedValue(false);
        expect(await manager.undo()).toBe(false);
        rollbackSpy.mockRestore();
    });

    test('addHistory reports a history folder that cannot be created', async () => {
        const filePath = '/docs/missing.owa';
        mocks.dirs.add('/docs');

        const { default: EditingHistoryManager } =
            await loadEditingHistoryModule();
        const manager = new EditingHistoryManager(filePath);

        await manager.addHistory('version 2');

        expect(mocks.handleErrorMock).toHaveBeenCalledTimes(1);
        expect(mocks.files.has(`${filePath}.histories/0-head`)).toBe(false);
    });

    test('getCurrentHistory falls back to the file and gives up on unreadable heads', async () => {
        const filePath = '/docs/current.owa';
        mocks.dirs.add('/docs');
        mocks.files.set(filePath, 'version 1');

        const { default: EditingHistoryManager } =
            await loadEditingHistoryModule();
        const { FileSource } = await loadMockedModules();
        const manager = new EditingHistoryManager(filePath);

        // no history folder: the on-disk file is the current state
        expect(await manager.getCurrentHistory()).toBe('version 1');

        await manager.addHistory('version 2');
        FileSource.readFileData.mockResolvedValue(null);

        vi.useFakeTimers();
        try {
            const pendingHistory = manager.getCurrentHistory();
            await vi.advanceTimersByTimeAsync(10 * 305);
            expect(await pendingHistory).toBeNull();
        } finally {
            vi.useRealTimers();
        }
    });

    test('checkHasHistories tracks the history folder', async () => {
        const filePath = '/docs/has.owa';
        mocks.dirs.add('/docs');
        mocks.files.set(filePath, 'version 1');

        const { default: EditingHistoryManager } =
            await loadEditingHistoryModule();
        const manager = new EditingHistoryManager(filePath);

        expect(await manager.checkHasHistories()).toBe(false);
        await manager.addHistory('version 2');
        expect(await manager.checkHasHistories()).toBe(true);
    });

    test('discard succeeds with nothing to undo and reports deletion failures', async () => {
        const filePath = '/docs/discard.owa';
        mocks.dirs.add('/docs');
        mocks.files.set(filePath, 'version 1');

        const { default: EditingHistoryManager } =
            await loadEditingHistoryModule();
        const manager = new EditingHistoryManager(filePath);

        expect(await manager.discard()).toBe(true);

        await manager.addHistory('version 2');
        const clearSpy = vi
            .spyOn(manager.fileLineHandler, 'clearHistories')
            .mockRejectedValue(new Error('locked'));

        expect(await manager.discard()).toBe(false);
        expect(mocks.handleErrorMock).toHaveBeenCalledTimes(1);
        clearSpy.mockRestore();
    });

    test('save reports an unreadable history and a failed write', async () => {
        const filePath = '/docs/save.owa';
        mocks.dirs.add('/docs');
        mocks.files.set(filePath, 'version 1');

        const { default: EditingHistoryManager } =
            await loadEditingHistoryModule();
        const manager = new EditingHistoryManager(filePath);
        const historySpy = vi
            .spyOn(manager, 'getCurrentHistory')
            .mockResolvedValue(null);

        expect(await manager.save()).toBe(false);

        historySpy.mockResolvedValue('version 2');
        mocks
            .getFileSource(filePath)
            .writeFileData.mockResolvedValueOnce(false);
        expect(await manager.save()).toBe(false);

        expect(await manager.save()).toBe(true);
        expect(mocks.files.get(filePath)).toBe('version 2');
    });

    test('moveFilePath skips missing folders and replaces an existing target', async () => {
        const filePath = '/docs/move.owa';
        const movedFilePath = '/moved/move.owa';
        mocks.dirs.add('/docs');
        mocks.dirs.add('/moved');

        const { default: EditingHistoryManager } =
            await loadEditingHistoryModule();

        expect(
            await EditingHistoryManager.moveFilePath(filePath, movedFilePath),
        ).toBeUndefined();

        mocks.dirs.add(`${filePath}.histories`);
        mocks.files.set(`${filePath}.histories/0-head`, 'version 1');
        mocks.dirs.add(`${movedFilePath}.histories`);
        mocks.files.set(`${movedFilePath}.histories/9-head`, 'stale');

        await EditingHistoryManager.moveFilePath(filePath, movedFilePath);

        expect(mocks.files.has(`${movedFilePath}.histories/9-head`)).toBe(
            false,
        );
        expect(mocks.files.get(`${movedFilePath}.histories/0-head`)).toBe(
            'version 1',
        );
    });
});
