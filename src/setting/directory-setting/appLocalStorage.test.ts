// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const {
    fsCheckDirExistMock,
    fsDeleteFileMock,
    fsExistSyncMock,
    fsListFilesMock,
    fsMkDirSyncMock,
    fsReadSyncMock,
    fsUnlinkSyncMock,
    fsWriteFileSyncMock,
    getUserWritablePathMock,
    handleErrorMock,
    pathJoinMock,
} = vi.hoisted(() => ({
    fsCheckDirExistMock: vi.fn(),
    fsDeleteFileMock: vi.fn(),
    fsExistSyncMock: vi.fn(),
    fsListFilesMock: vi.fn(),
    fsMkDirSyncMock: vi.fn(),
    fsReadSyncMock: vi.fn(),
    fsUnlinkSyncMock: vi.fn(),
    fsWriteFileSyncMock: vi.fn(),
    getUserWritablePathMock: vi.fn(() => '/user'),
    handleErrorMock: vi.fn(),
    pathJoinMock: vi.fn((...parts: string[]) => parts.join('/')),
}));

vi.mock('../../helper/errorHelpers', () => ({
    handleError: handleErrorMock,
}));

vi.mock('../../server/fileHelpers', () => ({
    fsCheckDirExist: fsCheckDirExistMock,
    fsDeleteFile: fsDeleteFileMock,
    fsExistSync: fsExistSyncMock,
    fsListFiles: fsListFilesMock,
    fsMkDirSync: fsMkDirSyncMock,
    fsReadSync: fsReadSyncMock,
    fsUnlinkSync: fsUnlinkSyncMock,
    fsWriteFileSync: fsWriteFileSyncMock,
    getUserWritablePath: getUserWritablePathMock,
    pathJoin: pathJoinMock,
}));

async function loadModule() {
    vi.resetModules();
    return await import('./appLocalStorage');
}

function stubStorage(initial: Record<string, string> = {}) {
    const storage = new Map<string, string>(Object.entries(initial));
    const localStorageMock = {
        getItem: vi.fn((key: string) => storage.get(key) ?? null),
        setItem: vi.fn((key: string, value: string) => {
            storage.set(key, value);
        }),
        removeItem: vi.fn((key: string) => {
            storage.delete(key);
        }),
        clear: vi.fn(() => {
            storage.clear();
        }),
    };
    vi.stubGlobal('localStorage', localStorageMock as any);
    return localStorageMock;
}

describe('appLocalStorage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    test('falls back to the user writable path and caches the default storage', async () => {
        const { appLocalStorage, SELECTED_PARENT_DIR_SETTING_NAME } =
            await loadModule();
        const localStorageMock = stubStorage({
            [SELECTED_PARENT_DIR_SETTING_NAME]: '/missing',
        });
        fsExistSyncMock.mockImplementation((path: string) => path === '/user');

        expect(appLocalStorage.defaultStorage).toBe('/user');
        expect(appLocalStorage.defaultStorage).toBe('/user');
        expect(localStorageMock.removeItem).toHaveBeenCalledWith(
            SELECTED_PARENT_DIR_SETTING_NAME,
        );
        expect(getUserWritablePathMock).toHaveBeenCalledTimes(1);
    });

    test('creates and caches the local storage directory path', async () => {
        const { appLocalStorage, SELECTED_PARENT_DIR_SETTING_NAME } =
            await loadModule();
        stubStorage({
            [SELECTED_PARENT_DIR_SETTING_NAME]: '/selected',
        });
        fsExistSyncMock.mockImplementation((path: string) => {
            return path !== '/selected/local-storage';
        });

        expect(appLocalStorage.localStorageDir).toBe('/selected/local-storage');
        expect(appLocalStorage.localStorageDir).toBe('/selected/local-storage');
        expect(fsMkDirSyncMock).toHaveBeenCalledWith(
            '/selected/local-storage',
            true,
        );
    });

    test('reads and validates the selected parent directory asynchronously', async () => {
        const { appLocalStorage, SELECTED_PARENT_DIR_SETTING_NAME } =
            await loadModule();
        stubStorage({
            [SELECTED_PARENT_DIR_SETTING_NAME]: '/parent',
        });
        fsCheckDirExistMock
            .mockResolvedValueOnce(false)
            .mockResolvedValueOnce(true);

        await expect(
            appLocalStorage.getSelectedParentDirectory(),
        ).resolves.toBeNull();
        await expect(
            appLocalStorage.getSelectedParentDirectory(),
        ).resolves.toBe('/parent');
    });

    test('stores selected parent directories only when they exist', async () => {
        const { appLocalStorage } = await loadModule();
        const localStorageMock = stubStorage();
        fsCheckDirExistMock.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

        await appLocalStorage.setSelectedParentDirectory('/parent');

        expect(localStorageMock.setItem).toHaveBeenCalledWith(
            'selected-parent-dir',
            '/parent',
        );

        await expect(
            appLocalStorage.setSelectedParentDirectory('/missing'),
        ).rejects.toThrow('Directory does not exist: /missing');
    });

    test('reads cached items, forces reloads, and returns null for missing files', async () => {
        const { appLocalStorage, SELECTED_PARENT_DIR_SETTING_NAME } =
            await loadModule();
        stubStorage({
            [SELECTED_PARENT_DIR_SETTING_NAME]: '/selected',
        });
        fsExistSyncMock.mockImplementation((path: string) => {
            return !path.endsWith('/missing');
        });
        fsReadSyncMock.mockReturnValueOnce('value-1').mockReturnValueOnce('value-2');

        expect(appLocalStorage.getItem('key.txt')).toBe('value-1');
        expect(appLocalStorage.getItem('key.txt')).toBe('value-1');
        expect(appLocalStorage.getItemForce('key.txt')).toBe('value-2');
        expect(appLocalStorage.getItem('missing')).toBeNull();
        expect(fsReadSyncMock).toHaveBeenCalledTimes(2);
    });

    test('handles read failures by reporting the error and returning null', async () => {
        const { appLocalStorage, SELECTED_PARENT_DIR_SETTING_NAME } =
            await loadModule();
        stubStorage({
            [SELECTED_PARENT_DIR_SETTING_NAME]: '/selected',
        });
        const error = new Error('read failed');
        fsExistSyncMock.mockReturnValue(true);
        fsReadSyncMock.mockImplementation(() => {
            throw error;
        });

        expect(appLocalStorage.getItem('broken.txt')).toBeNull();
        expect(handleErrorMock).toHaveBeenCalledWith(error);
    });

    test('writes items and serves them from cache afterwards', async () => {
        const { appLocalStorage, SELECTED_PARENT_DIR_SETTING_NAME } =
            await loadModule();
        stubStorage({
            [SELECTED_PARENT_DIR_SETTING_NAME]: '/selected',
        });
        fsExistSyncMock.mockImplementation((path: string) => {
            return path === '/selected' || path === '/selected/local-storage';
        });

        appLocalStorage.setItem('saved.txt', 'cached-value');

        expect(fsWriteFileSyncMock).toHaveBeenCalledWith(
            '/selected/local-storage/saved.txt',
            'cached-value',
        );
        expect(appLocalStorage.getItem('saved.txt')).toBe('cached-value');
        expect(fsReadSyncMock).not.toHaveBeenCalled();
    });

    test('reports unlink failures when removing stored items', async () => {
        const { appLocalStorage, SELECTED_PARENT_DIR_SETTING_NAME } =
            await loadModule();
        stubStorage({
            [SELECTED_PARENT_DIR_SETTING_NAME]: '/selected',
        });
        const error = new Error('unlink failed');
        fsUnlinkSyncMock.mockImplementation(() => {
            throw error;
        });

        appLocalStorage.removeItem('dead.txt');

        expect(handleErrorMock).toHaveBeenCalledWith(error);
    });

    test('clears stored files and localStorage, or reports clear failures', async () => {
        const { appLocalStorage, SELECTED_PARENT_DIR_SETTING_NAME } =
            await loadModule();
        const localStorageMock = stubStorage({
            [SELECTED_PARENT_DIR_SETTING_NAME]: '/selected',
        });
        fsExistSyncMock.mockImplementation((path: string) => {
            return path === '/selected' || path === '/selected/local-storage';
        });
        fsListFilesMock.mockResolvedValueOnce(['a.txt', 'b.txt']);

        await appLocalStorage.clear();

        expect(fsDeleteFileMock).toHaveBeenCalledWith(
            '/selected/local-storage/a.txt',
        );
        expect(fsDeleteFileMock).toHaveBeenCalledWith(
            '/selected/local-storage/b.txt',
        );
        expect(localStorageMock.clear).toHaveBeenCalledTimes(1);

        const error = new Error('clear failed');
        fsListFilesMock.mockResolvedValueOnce(['broken.txt']);
        fsDeleteFileMock.mockRejectedValueOnce(error);

        await appLocalStorage.clear();

        expect(handleErrorMock).toHaveBeenCalledWith(error);
    });
});
