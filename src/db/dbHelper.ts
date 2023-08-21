export const DB_NAME = 'bible';
export const DB_VERSION = 3;

interface DbControllerInterface {
    db: IDBDatabase;
    isDbOpened: boolean;
    createObjectStore: () => void;
    initCallback: <T>(target: any,
        resolve: (e: T) => void,
        reject: (e: string) => void) => void;
};

export type RecordType = {
    id: string;
    data: any;
    createdAt: Date;
    updatedAt: Date;
};

class InitDBOpeningQueue {
    request: IDBOpenDBRequest | null = null;
    promises: {
        resolve: () => void,
        reject: (reason: any) => void,
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
    attemptDbOpening(dbController: DbControllerInterface,
        resolve: () => void, reject: (reason: any) => void) {
        if (dbController.isDbOpened) {
            this.resolve();
            return;
        }
        this.promises.push({ resolve, reject });
        if (this.request !== null) {
            return;
        }
        const request = window.indexedDB.open(DB_NAME, DB_VERSION);
        this.request = request;
        request.onupgradeneeded = (event: any) => {
            dbController.db = event.target.result;
            dbController.createObjectStore();
        };
        dbController.initCallback<Event>(request, (event: any) => {
            dbController.db = event.target.result;
            this.request = null;
            this.resolve();
        }, () => {
            this.request = null;
            this.reject(request.error);
        });
    }
}

abstract class IndexedDbController implements DbControllerInterface {
    static _instance: IndexedDbController | null = null;
    abstract get storeName(): string;
    private _initQueue: InitDBOpeningQueue = new InitDBOpeningQueue();
    static instantiate(): IndexedDbController {
        throw new Error('Not implemented');
    }
    _db: IDBDatabase | null = null;
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
    initCallback<T>(target: any,
        resolve: (e: T) => void,
        reject: (e: string) => void) {
        target.onsuccess = function (event: T) {
            resolve(event);
        };
        target.onerror = function () {
            reject(this.error);
        };
    }
    _getTransaction(mode: IDBTransactionMode) {
        if (!this.db.objectStoreNames.contains(this.storeName)) {
            throw new Error(`Object store ${this.storeName} does not exist`);
        }
        const transaction = this.db.transaction([this.storeName], mode);
        const store = transaction.objectStore(this.storeName);
        return { store, transaction };
    }
    createObjectStore() {
        if (this.db.objectStoreNames.contains(this.storeName)) {
            return;
        }
        this.db.createObjectStore(this.storeName, {
            keyPath: 'id',
            autoIncrement: false,
        });
    }
    init() {
        return new Promise<void>((resolve, reject) => {
            this._initQueue.attemptDbOpening(this, resolve, reject);
        });
    }

    _asyncOperation<T>(mode: IDBTransactionMode,
        init: (target: IDBObjectStore) => T) {
        return new Promise<T>((resolve, reject) => {
            const { store } = this._getTransaction(mode);
            const target = init(store);
            this.initCallback(target, () => {
                resolve(target);
            }, reject);
        });
    }
    async addItem(id: string, data: any, isForceOverride = false) {
        const oldData = await this.getItem(id);
        if (oldData !== undefined) {
            if (!isForceOverride) {
                throw new Error(`Item with id ${id} already exists`);
            }
            await this.deleteItem(id);
        }
        await this._asyncOperation('readwrite', (store) => {
            return store.add({
                id, data, ...{
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
            });
        });
    }
    async getItem<T>(id: string) {
        const request = await this._asyncOperation('readonly', (store) => {
            return store.get(id);
        });
        if (!request.result) {
            return null;
        }
        return request.result as {
            id: string;
            data: T;
            createdAt: Date;
            updatedAt: Date;
        };
    }
    updateItem(id: string, data: any) {
        return this._asyncOperation('readwrite', (store) => {
            return store.put({
                id, data, ...{
                    updatedAt: new Date(),
                },
            });
        });
    }
    deleteItem(id: string) {
        return this._asyncOperation('readwrite', (store) => {
            return store.delete(id);
        });
    }
    countAllItems() {
        return this._asyncOperation('readonly', (store) => {
            return store.count();
        });
    }
    clearAllItems() {
        return this._asyncOperation('readwrite', (store) => {
            return store.clear();
        });
    }
    closeDb() {
        this.db = null;
    }
    static async getInstance() {
        if (this._instance === null) {
            this._instance = this.instantiate();
        }
        await this._instance.init();
        return this._instance;
    }
}

export class BibleRefsDbController extends IndexedDbController {
    get storeName() {
        return 'bible_refs';
    }
    static instantiate() {
        return new this();
    }
}
