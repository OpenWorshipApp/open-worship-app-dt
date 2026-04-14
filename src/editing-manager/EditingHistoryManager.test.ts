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

vi.mock('../others/GarbageCollectableCacher', () => ({
    default: class GarbageCollectableCacherMock<T> {
        private readonly store = new Map<string, T>();

        constructor(_maxSize: number) {}

        get(key: string) {
            return this.store.has(key) ? (this.store.get(key) ?? null) : null;
        }

        set(key: string, value: T) {
            this.store.set(key, value);
        }

        delete(key: string) {
            this.store.delete(key);
        }
    },
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
        getInstance: (filePath: string) => {
            return mocks.getFileSource(filePath);
        },
        readFileData: async (filePath: string) => {
            return mocks.files.get(mocks.normalizePath(filePath)) ?? null;
        },
        writeFilePlainText: async (filePath: string, data: string) => {
            const normalizedPath = mocks.normalizePath(filePath);
            const dirPath = mocks.getDirName(normalizedPath);
            if (dirPath) {
                mocks.dirs.add(dirPath);
            }
            mocks.files.set(normalizedPath, data);
            return true;
        },
    },
}));

async function loadEditingHistoryModule() {
    return await import('./EditingHistoryManager');
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
        expect(mocks.files.has(`${movedFilePath}.histories/1-head`)).toBe(
            true,
        );
    });
});
