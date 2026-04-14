import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    handleErrorMock: vi.fn(),
}));

vi.mock('../helper/errorHelpers', () => ({
    handleError: mocks.handleErrorMock,
}));

vi.mock('../server/appProvider', () => ({
    default: {
        appInfo: {
            versionNumber: 7,
        },
    },
}));

import { DB_NAME, IndexedDbController } from './databaseHelpers';

class TestDbController extends IndexedDbController {
    override get storeName() {
        return 'songs';
    }

    static override instantiate() {
        return new this();
    }
}

function createAsyncRequest(result?: unknown, error?: unknown) {
    const request: any = {
        error,
        onerror: null,
        onsuccess: null,
        result: undefined,
    };
    queueMicrotask(() => {
        if (error !== undefined) {
            request.error = error;
            request.onerror?.();
            return;
        }
        request.result = result;
        request.onsuccess?.({ target: request });
    });
    return request;
}

function createStoreHarness(initialRecords: Record<string, any> = {}) {
    const records = new Map<string, any>(Object.entries(initialRecords));
    const add = vi.fn((item: any) => {
        records.set(item.id, item);
        return createAsyncRequest(item);
    });
    const clear = vi.fn(() => {
        records.clear();
        return createAsyncRequest();
    });
    const count = vi.fn(() => createAsyncRequest(records.size));
    const del = vi.fn((id: string) => {
        records.delete(id);
        return createAsyncRequest();
    });
    const get = vi.fn((id: string) => createAsyncRequest(records.get(id)));
    const getAllKeys = vi.fn((range: { value: [string] }) => {
        const secondaryId = range.value[0];
        const keys = [...records.values()]
            .filter((item) => item.secondaryId === secondaryId)
            .map((item) => item.id);
        return createAsyncRequest(keys);
    });
    const index = vi.fn(() => ({
        getAllKeys,
    }));
    const put = vi.fn((item: any) => {
        records.set(item.id, item);
        return createAsyncRequest(item);
    });

    const store = {
        add,
        clear,
        count,
        delete: del,
        get,
        index,
        put,
    };

    const transaction = {
        objectStore: vi.fn(() => store),
    };

    const db = {
        close: vi.fn(),
        createObjectStore: vi.fn(() => ({
            createIndex: vi.fn(),
        })),
        deleteObjectStore: vi.fn(),
        objectStoreNames: {
            contains: vi.fn((storeName: string) => storeName === 'songs'),
        },
        transaction: vi.fn(() => transaction),
    };

    return {
        db,
        records,
        store,
        transaction,
    };
}

describe('databaseHelpers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        IndexedDbController.instances.clear();

        const openMock = vi.fn(() => {
            return {
                error: new Error('open failed'),
                onerror: null,
                onsuccess: null,
                onupgradeneeded: null,
            };
        });

        Object.defineProperty(globalThis, 'indexedDB', {
            configurable: true,
            value: {
                open: openMock,
            },
        });

        Object.defineProperty(globalThis, 'IDBKeyRange', {
            configurable: true,
            value: {
                only: vi.fn((value: [string]) => ({ value })),
            },
        });
    });

    test('initializes the database once, queues concurrent opens, and caches controller instances', async () => {
        const controller = new TestDbController();
        const createObjectStoreSpy = vi.spyOn(controller, 'createObjectStore');
        const openMock = (globalThis.indexedDB.open as any) as ReturnType<typeof vi.fn>;

        const init1 = controller.init();
        const init2 = controller.init();
        expect(openMock).toHaveBeenCalledWith(DB_NAME, 7);
        expect(openMock).toHaveBeenCalledTimes(1);

        const openRequest = openMock.mock.results[0]?.value;

        const { db } = createStoreHarness();
        openRequest.onupgradeneeded?.({ target: { result: db } });
        openRequest.onsuccess?.({ target: { result: db } });
        await Promise.all([init1, init2]);

        expect(createObjectStoreSpy).toHaveBeenCalledTimes(1);
        expect(controller.db).toBe(db);

        await controller.init();
        expect(openMock).toHaveBeenCalledTimes(1);

        const instance1 = TestDbController.getInstance();
        const instanceOpenRequest = openMock.mock.results[1]?.value;
        const { db: instanceDb } = createStoreHarness();
        instanceOpenRequest.onupgradeneeded?.({ target: { result: instanceDb } });
        instanceOpenRequest.onsuccess?.({ target: { result: instanceDb } });
        const resolved1 = await instance1;
        const resolved2 = await TestDbController.getInstance();
        expect(resolved1).toBeInstanceOf(TestDbController);
        expect(resolved2).toBe(resolved1);
        expect(openMock).toHaveBeenCalledTimes(2);
    });

    test('rejects queued init requests on open failure and wires init callbacks', async () => {
        const controller = new TestDbController();
        const openMock = (globalThis.indexedDB.open as any) as ReturnType<typeof vi.fn>;
        const init1 = controller.init();
        const init2 = controller.init();
        const openRequest = openMock.mock.results[0]?.value;

        openRequest.error = 'boom';
        openRequest.onerror?.();

        await expect(init1).rejects.toBe('boom');
        await expect(init2).rejects.toBe('boom');

        const target: any = {};
        const resolve = vi.fn();
        const reject = vi.fn();
        controller.initCallback(target, resolve, reject);
        target.onsuccess('ok');
        expect(resolve).toHaveBeenCalledWith('ok');
        target.error = 'nope';
        target.onerror();
        expect(reject).toHaveBeenCalledWith('nope');
    });

    test('manages object store creation, db replacement, and missing-store failures', async () => {
        const controller = new TestDbController();
        const first = createStoreHarness().db;
        const secondHarness = createStoreHarness();
        secondHarness.db.deleteObjectStore.mockImplementation(() => {
            throw new Error('missing old store');
        });

        controller.db = first as any;
        controller.db = first as any;
        expect(first.close).toHaveBeenCalledTimes(0);

        controller.db = secondHarness.db as any;
        expect(first.close).toHaveBeenCalledTimes(1);

        controller.createObjectStore();
        expect(mocks.handleErrorMock).toHaveBeenCalledWith(expect.any(Error));
        expect(secondHarness.db.createObjectStore).toHaveBeenCalledWith('songs', {
            autoIncrement: false,
            keyPath: 'id',
        });
        const createdStore = secondHarness.db.createObjectStore.mock.results[0]?.value;
        expect(createdStore.createIndex).toHaveBeenCalledWith('index1', ['secondaryId'], {
            unique: false,
        });

        const missingStoreDb = createStoreHarness().db;
        missingStoreDb.objectStoreNames.contains.mockReturnValue(false);
        controller.db = missingStoreDb as any;
        await expect(controller.countAllItems()).rejects.toThrow(
            'Object store songs does not exist',
        );

        controller.closeDb();
        expect(missingStoreDb.close).toHaveBeenCalledTimes(1);
        expect(() => controller.db).toThrow('DB is not initialized');
        expect(() => IndexedDbController.instantiate()).toThrow('Not implemented');
    });

    test('supports add get update delete count clear and secondary-key lookups', async () => {
        const controller = new TestDbController();
        const harness = createStoreHarness({
            existing: {
                createdAt: new Date('2026-04-13T00:00:00.000Z'),
                data: { title: 'old' },
                id: 'existing',
                secondaryId: 'group-1',
                updatedAt: new Date('2026-04-13T00:00:00.000Z'),
            },
        });
        controller.db = harness.db as any;

        await controller.addItem({
            data: { title: 'new' },
            id: 'new-item',
            secondaryId: 'group-2',
        });
        expect(harness.store.add).toHaveBeenCalledWith(
            expect.objectContaining({
                data: { title: 'new' },
                id: 'new-item',
                secondaryId: 'group-2',
            }),
        );
        expect(harness.store.add.mock.calls[0]?.[0]?.createdAt).toBeInstanceOf(Date);
        expect(harness.store.add.mock.calls[0]?.[0]?.updatedAt).toBeInstanceOf(Date);

        await expect(
            controller.addItem({
                data: { title: 'duplicate' },
                id: 'existing',
            }),
        ).rejects.toThrow('Item with id existing already exists');

        const deleteSpy = vi.spyOn(controller, 'deleteItem');
        await controller.addItem({
            data: { title: 'replacement' },
            id: 'existing',
            isForceOverride: true,
        });
        expect(deleteSpy).toHaveBeenCalledWith('existing');

        expect(await controller.getItem<{ title: string }>('new-item')).toEqual(
            expect.objectContaining({
                data: { title: 'new' },
                id: 'new-item',
            }),
        );
        expect(await controller.getItem('missing')).toBeNull();

        const keyRequest = await controller.getKeys('group-2');
        expect((globalThis.IDBKeyRange.only as any)).toHaveBeenCalledWith(['group-2']);
        expect(keyRequest).toEqual(['new-item']);

        const updateRequest: any = await controller.updateItem('new-item', { title: 'updated' });
        expect(harness.store.put).toHaveBeenCalledWith(
            expect.objectContaining({
                data: { title: 'updated' },
                id: 'new-item',
            }),
        );
        expect(updateRequest.result).toEqual(
            expect.objectContaining({
                data: { title: 'updated' },
                id: 'new-item',
            }),
        );

        const countRequest: any = await controller.countAllItems();
        expect(countRequest.result).toBe(2);

        await controller.deleteItem('new-item');
        expect(await controller.getItem('new-item')).toBeNull();

        await controller.clearAllItems();
        const clearedCount: any = await controller.countAllItems();
        expect(clearedCount.result).toBe(0);
    });
});
