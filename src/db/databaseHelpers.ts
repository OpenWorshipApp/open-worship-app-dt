export const DB_NAME = 'bible';

interface DatabaseControllerInterface {
    db: IDBDatabase;
    isDbOpened: boolean;
    storeName: string;
    closeDb: () => void;
    createObjectStore: () => void;
    initCallback: <T>(
        target: any,
        resolve: (e: T) => void,
        reject: (e: string) => void,
    ) => void;
}

export type ItemParamsType = {
    id: string;
    data: any;
    isForceOverride?: boolean;
    secondaryId?: string | null;
};

type BasicRecordType = {
    id: string;
    secondaryId?: string | null;
    createdAt: Date;
    updatedAt: Date;
};
export type RecordType = BasicRecordType & {
    data: any;
};

class InitDBOpeningQueue {
    request: IDBOpenDBRequest | null = null;
    promises: {
        resolve: () => void;
        reject: (reason: any) => void;
    }[] = [];

    resolve() {
        while (this.promises.length > 0) {
            const { resolve } = this.promises.shift() as any;
            resolve();
        }
    }

    reject(reason: any) {
        while (this.promises.length > 0) {
            const { reject } = this.promises.shift() as any;
            reject(reason);
        }
    }

    attemptDbOpening(
        dbController: DatabaseControllerInterface,
        resolve: () => void,
        reject: (reason: any) => void,
    ) {
        this.promises.push({ resolve, reject });
        if (dbController.isDbOpened) {
            this.resolve();
            return;
        }
        if (this.request !== null) {
            return;
        }
        this.openDb(dbController);
    }

    // The schema version is intentionally decoupled from the app version:
    // opening without a version keeps whatever exists (no downgrade error, no
    // wipe on app update); the version is bumped only when a store is missing.
    private openDb(
        dbController: DatabaseControllerInterface,
        version?: number,
    ) {
        const request =
            version === undefined
                ? globalThis.indexedDB.open(DB_NAME)
                : globalThis.indexedDB.open(DB_NAME, version);
        this.request = request;
        request.onblocked = () => {
            this.request = null;
            this.reject(
                new Error('Database opening blocked by another connection'),
            );
        };
        request.onupgradeneeded = (event: any) => {
            dbController.db = event.target.result;
            dbController.createObjectStore();
        };
        dbController.initCallback<Event>(
            request,
            (event: any) => {
                const db: IDBDatabase = event.target.result;
                if (!db.objectStoreNames.contains(dbController.storeName)) {
                    // existing db predating this store — bump to create it
                    db.close();
                    this.request = null;
                    this.openDb(dbController, db.version + 1);
                    return;
                }
                db.onversionchange = () => {
                    dbController.closeDb();
                };
                dbController.db = db;
                this.request = null;
                this.resolve();
            },
            () => {
                this.request = null;
                this.reject(request.error);
            },
        );
    }
}

export abstract class IndexedDbController implements DatabaseControllerInterface {
    static readonly instances = new Map<
        typeof IndexedDbController,
        IndexedDbController
    >();

    abstract get storeName(): string;
    private readonly initQueue: InitDBOpeningQueue = new InitDBOpeningQueue();

    static instantiate(): IndexedDbController {
        throw new Error('Not implemented');
    }

    private _db: IDBDatabase | null = null;

    get isDbOpened() {
        return this._db !== null;
    }

    set db(db: IDBDatabase | null) {
        if (this._db === db) {
            return;
        }
        if (this.isDbOpened) {
            this._db?.close();
        }
        this._db = db;
    }

    get db(): IDBDatabase {
        if (this._db === null) {
            throw new Error('DB is not initialized');
        }
        return this._db;
    }

    initCallback<T>(
        target: any,
        resolve: (e: T) => void,
        reject: (e: string) => void,
    ) {
        target.onsuccess = function (event: T) {
            resolve(event);
        };
        target.onerror = function () {
            reject(this.error);
        };
    }

    private getTransaction(mode: IDBTransactionMode) {
        if (!this.db.objectStoreNames.contains(this.storeName)) {
            throw new Error(`Object store ${this.storeName} does not exist`);
        }
        const transaction = this.db.transaction([this.storeName], mode);
        const store = transaction.objectStore(this.storeName);
        return { store, transaction };
    }

    createObjectStore() {
        // Never delete-recreate — the store holds user data (decrypted bible
        // cache) that must survive app updates.
        if (this.db.objectStoreNames.contains(this.storeName)) {
            return;
        }
        const store = this.db.createObjectStore(this.storeName, {
            keyPath: 'id',
            autoIncrement: false,
        });
        store.createIndex('index1', ['secondaryId'], { unique: false });
    }

    init() {
        return new Promise<void>((resolve, reject) => {
            this.initQueue.attemptDbOpening(this, resolve, reject);
        });
    }

    private asyncOperation<T>(
        mode: IDBTransactionMode,
        init: (target: IDBObjectStore) => T,
    ) {
        return new Promise<T>((resolve, reject) => {
            const { store } = this.getTransaction(mode);
            const target = init(store);
            this.initCallback(
                target,
                () => {
                    resolve(target);
                },
                reject,
            );
        });
    }

    async addItem({
        id,
        data,
        isForceOverride = false,
        secondaryId = null,
    }: ItemParamsType) {
        const oldData = await this.getItem(id);
        if (oldData !== null) {
            if (!isForceOverride) {
                throw new Error(`Item with id ${id} already exists`);
            }
            await this.deleteItem(id);
        }
        await this.asyncOperation('readwrite', (store) => {
            const newItem: RecordType = {
                id,
                secondaryId,
                data,
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            return store.add(newItem);
        });
    }

    async getItem<T>(id: string) {
        const request = await this.asyncOperation('readonly', (store) => {
            return store.get(id);
        });
        if (!request.result) {
            return null;
        }
        return request.result as BasicRecordType & { data: T };
    }

    async getKeys(secondaryId: string) {
        const request = await this.asyncOperation('readonly', (store) => {
            const index = store.index('index1');
            const range = IDBKeyRange.only([secondaryId]);
            return index.getAllKeys(range);
        });
        if (!request.result) {
            return null;
        }
        return request.result as string[];
    }

    async updateItem(id: string, data: any) {
        const oldItem = await this.getItem(id);
        return await this.asyncOperation('readwrite', (store) => {
            // preserve secondaryId/createdAt — a bare put would drop the
            // record out of the secondaryId index
            return store.put({
                id,
                secondaryId: oldItem?.secondaryId ?? null,
                createdAt: oldItem?.createdAt ?? new Date(),
                data,
                updatedAt: new Date(),
            });
        });
    }

    deleteItem(id: string) {
        return this.asyncOperation('readwrite', (store) => {
            return store.delete(id);
        });
    }

    countAllItems() {
        return this.asyncOperation('readonly', (store) => {
            return store.count();
        });
    }

    clearAllItems() {
        return this.asyncOperation('readwrite', (store) => {
            return store.clear();
        });
    }

    closeDb() {
        this.db = null;
    }

    static async getInstance() {
        let instance = this.instances.get(this);
        if (instance === undefined) {
            instance = this.instantiate();
            this.instances.set(this, instance);
        }
        await instance.init();
        return instance;
    }
}
