import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => {
    const cacheStores: Map<string, unknown>[] = [];

    class MockCacheManager<T> {
        private readonly store = new Map<string, T>();

        constructor(_ttl: number) {
            cacheStores.push(this.store as Map<string, unknown>);
        }

        async get(key: string) {
            return this.store.has(key) ? this.store.get(key) : null;
        }

        async set(key: string, value: T) {
            this.store.set(key, value);
        }
    }

    return {
        MockCacheManager,
        addItemMock: vi.fn(),
        base64DecodeMock: vi.fn(),
        cacheStores,
        checkIsBibleXMLMock: vi.fn(),
        decryptMock: vi.fn(),
        deleteItemMock: vi.fn(),
        fsCreateDirMock: vi.fn(),
        getDatabaseInstanceMock: vi.fn(),
        getItemMock: vi.fn(),
        getKeysMock: vi.fn(),
        handleErrorMock: vi.fn(),
        hideProgressBarMock: vi.fn(),
        pathJoinMock: vi.fn((...parts: string[]) =>
            parts.join('/').replaceAll('//', '/'),
        ),
        readBibleXMLDataMock: vi.fn(),
        readFileDataMock: vi.fn(),
        reset() {
            cacheStores.length = 0;
        },
        showProgressBarMock: vi.fn(),
        unlockingMock: vi.fn(
            async (_key: string, callback: () => Promise<unknown>) => {
                return callback();
            },
        ),
    };
});

vi.mock('../../server/appProvider', () => ({
    default: {
        appUtils: {
            base64Decode: mocks.base64DecodeMock,
        },
        systemUtils: {
            isDev: false,
        },
        envUtils: {
            isFEUseEffectWarning: false,
        },
        // langHelpers registers a menu listener at module load.
        messageUtils: {
            listenForData: vi.fn(),
            sendData: vi.fn(),
        },
    },
}));

vi.mock('../../server/fileHelpers', () => ({
    fsCreateDir: mocks.fsCreateDirMock,
    pathJoin: mocks.pathJoinMock,
}));

vi.mock('../../_owa-crypto', () => ({
    decrypt: mocks.decryptMock,
}));

vi.mock('../errorHelpers', () => ({
    handleError: mocks.handleErrorMock,
}));

vi.mock('../../progress-bar/progressBarHelpers', () => ({
    hideProgressBar: mocks.hideProgressBarMock,
    showProgressBar: mocks.showProgressBarMock,
}));

vi.mock('./BibleDatabaseController', () => ({
    default: {
        getInstance: mocks.getDatabaseInstanceMock,
    },
}));

vi.mock('../FileSource', () => ({
    default: {
        readFileData: mocks.readFileDataMock,
    },
}));

vi.mock('../../others/CacheManager', () => ({
    default: mocks.MockCacheManager,
}));

vi.mock('../../setting/directory-setting/appLocalStorage', () => ({
    appLocalStorage: {
        defaultStorage: '/storage',
    },
}));

vi.mock('../../server/unlockingHelpers', () => ({
    unlocking: mocks.unlockingMock,
}));

vi.mock('./bibleInfoHelpers', () => ({
    checkIsBibleXML: mocks.checkIsBibleXMLMock,
}));

vi.mock('../../setting/bible-setting/bibleXMLHelpers', () => ({
    readBibleXMLData: mocks.readBibleXMLDataMock,
}));

async function loadModule() {
    return await import('./BibleDataReader');
}

describe('BibleDataReader', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
        mocks.reset();

        mocks.base64DecodeMock.mockImplementation((value: string) => value);
        mocks.fsCreateDirMock.mockResolvedValue(undefined);
        mocks.checkIsBibleXMLMock.mockResolvedValue(false);
        mocks.getItemMock.mockResolvedValue(null);
        mocks.addItemMock.mockResolvedValue(true);
        mocks.getKeysMock.mockResolvedValue(null);
        mocks.deleteItemMock.mockResolvedValue(true);
        mocks.getDatabaseInstanceMock.mockResolvedValue({
            addItem: mocks.addItemMock,
            deleteItem: mocks.deleteItemMock,
            getItem: mocks.getItemMock,
            getKeys: mocks.getKeysMock,
        });
        mocks.decryptMock.mockImplementation((value: string) => value);
        mocks.readFileDataMock.mockResolvedValue(null);
        mocks.readBibleXMLDataMock.mockResolvedValue({ from: 'xml' });
    });

    test('caches the database controller and reads downloaded bible data from file storage', async () => {
        const { default: BibleDataReader } = await loadModule();
        const reader = new BibleDataReader();
        const firstController = await reader.getDatabaseController();
        const secondController = await reader.getDatabaseController();

        expect(firstController).toBe(secondController);
        expect(mocks.getDatabaseInstanceMock).toHaveBeenCalledTimes(1);

        const json = JSON.stringify({ title: 'King James Version' });
        mocks.base64DecodeMock.mockReturnValueOnce(json);
        mocks.readFileDataMock.mockResolvedValueOnce('encrypted-file-data');
        const data = await reader.readBibleDownloadedData('KJV', '_info');

        expect(data).toEqual({ title: 'King James Version' });
        expect(mocks.showProgressBarMock).toHaveBeenCalledWith(
            'Reading bible data from "/storage/bibles-data/KJV/_info"',
        );
        expect(mocks.readFileDataMock).toHaveBeenCalledWith(
            '/storage/bibles-data/KJV/_info',
            true,
        );
        expect(mocks.decryptMock).toHaveBeenCalledWith('encrypted-file-data');
        expect(mocks.addItemMock).toHaveBeenCalledWith({
            data: 'encrypted-file-data',
            id: '/storage/bibles-data/KJV/_info',
            isForceOverride: true,
            secondaryId: 'KJV',
        });
        expect(mocks.hideProgressBarMock).toHaveBeenCalledWith(
            'Reading bible data from "/storage/bibles-data/KJV/_info"',
        );
    });

    test('prefers cached database records and handles missing and failing file reads', async () => {
        const { default: BibleDataReader } = await loadModule();
        const reader = new BibleDataReader();

        mocks.getItemMock.mockResolvedValueOnce({
            data: '{"title":"From DB"}',
        });
        mocks.base64DecodeMock.mockReturnValueOnce('{"title":"From DB"}');
        expect(await reader.readBibleDownloadedData('WEB', '_info')).toEqual({
            title: 'From DB',
        });
        expect(mocks.readFileDataMock).not.toHaveBeenCalled();

        mocks.getItemMock.mockResolvedValueOnce(null);
        mocks.readFileDataMock.mockResolvedValueOnce(null);
        expect(
            await reader.readBibleDownloadedData('WEB', '0001-GEN.1'),
        ).toBeNull();

        mocks.getItemMock.mockRejectedValueOnce({ code: 'ENOENT' });
        expect(await reader.readBibleDownloadedData('WEB', '_info')).toBeNull();
        expect(mocks.handleErrorMock).not.toHaveBeenCalled();

        mocks.getItemMock.mockRejectedValueOnce(new Error('Boom'));
        expect(await reader.readBibleDownloadedData('WEB', '_info')).toBeNull();
        expect(mocks.handleErrorMock).toHaveBeenCalledTimes(1);
    });

    test('routes bible reads through xml or downloaded readers and caches the result', async () => {
        const { default: BibleDataReader } = await loadModule();
        const reader = new BibleDataReader();
        const readBibleDownloadedDataSpy = vi
            .spyOn(reader, 'readBibleDownloadedData')
            .mockResolvedValue({ from: 'download' } as any);

        expect(await reader.readBibleData('KJV', '_info')).toEqual({
            from: 'download',
        });
        expect(await reader.readBibleData('KJV', '_info')).toEqual({
            from: 'download',
        });
        expect(readBibleDownloadedDataSpy).toHaveBeenCalledTimes(1);

        mocks.checkIsBibleXMLMock.mockResolvedValueOnce(true);
        expect(await reader.readBibleData('XML', '_info')).toEqual({
            from: 'xml',
        });
        expect(mocks.readBibleXMLDataMock).toHaveBeenCalledWith('XML', '_info');
    });

    test('creates and caches writable bible paths and clears stored bible database data', async () => {
        const { default: BibleDataReader } = await loadModule();
        const reader = new BibleDataReader();

        expect(await reader.toBiblePath('KJV')).toBe(
            '/storage/bibles-data/KJV',
        );
        expect(await reader.getWritableBiblePath()).toBe(
            '/storage/bibles-data',
        );
        expect(mocks.fsCreateDirMock).toHaveBeenCalledTimes(1);

        mocks.fsCreateDirMock.mockRejectedValueOnce(
            new Error('file already exists'),
        );
        const nextReader = new BibleDataReader();
        expect(await nextReader.getWritableBiblePath()).toBe(
            '/storage/bibles-data',
        );
        expect(mocks.handleErrorMock).toHaveBeenCalledTimes(0);

        mocks.fsCreateDirMock.mockRejectedValueOnce(
            new Error('permission denied'),
        );
        const lastReader = new BibleDataReader();
        expect(await lastReader.getWritableBiblePath()).toBe(
            '/storage/bibles-data',
        );
        expect(mocks.handleErrorMock).toHaveBeenCalledTimes(1);

        mocks.getKeysMock.mockResolvedValueOnce(['key-1', 'key-2']);
        await lastReader.clearBibleDatabaseData('KJV');
        await Promise.resolve();
        expect(mocks.deleteItemMock).toHaveBeenCalledTimes(2);
        expect(mocks.deleteItemMock).toHaveBeenCalledWith('key-1');
        expect(mocks.deleteItemMock).toHaveBeenCalledWith('key-2');
    });
});
