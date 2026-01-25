import { handleError } from '../helper/errorHelpers';
import appProvider from '../server/appProvider';

export const DB_NAME = 'bible';

interface DatabaseControllerInterface {
    db: IDBDatabase;
    isDbOpened: boolean;
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
        const request = globalThis.indexedDB.open(
            DB_NAME,
            appProvider.appInfo.versionNumber,
        );
        this.request = request;
        request.onupgradeneeded = (event: any) => {
            dbController.db = event.target.result;
            dbController.createObjectStore();
        };
        dbController.initCallback<Event>(
            request,
            (event: any) => {
                dbController.db = event.target.result;
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
    static instance: IndexedDbController | null = null;

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
        if (!this.isDbOpened) {
            throw new Error('DB is not initialized');
        }
        return this._db as IDBDatabase;
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
        try {
            this.db.deleteObjectStore(this.storeName);
        } catch (error) {
            handleError(error);
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
        if (oldData !== undefined) {
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

    updateItem(id: string, data: any) {
        return this.asyncOperation('readwrite', (store) => {
            return store.put({
                id,
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
        if (this.instance === null) {
            this.instance = this.instantiate();
        }
        await this.instance.init();
        return this.instance;
    }
}
