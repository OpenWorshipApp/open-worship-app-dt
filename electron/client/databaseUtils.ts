import { join } from 'node:path';
import {
    isWindows,
    isMac,
    attemptClosing,
    toUnpackedPath,
} from '../electronHelpers';

// https://nodejs.org/docs/latest-v22.x/api/sqlite.html
// `node:sqlite` exists from Node 22.5 (Electron 35+). The Electron 32 build
// for older Intel Macs runs Node 20, where requiring it throws "No such
// built-in module" -- callers ask `checkIsSupported()` first and fall back.
let isSQLiteSupported: boolean | null = null;
function checkIsSQLiteSupported() {
    if (isSQLiteSupported === null) {
        try {
            require('node:sqlite');
            isSQLiteSupported = true;
        } catch (_error) {
            isSQLiteSupported = false;
        }
    }
    return isSQLiteSupported;
}

function getFileExt() {
    if (isWindows) {
        return 'dll';
    }
    if (isMac) {
        return 'dylib';
    }
    return 'so';
}

async function getLibFilePath(libName: string) {
    const libFileExt = getFileExt();
    const destFilePath = toUnpackedPath(
        join(__dirname, '../../db-exts', `${libName}.${libFileExt}`),
    );
    return destFilePath;
}

class SQLiteDatabase {
    public database: any;
    databaseFilePath: string;
    constructor(databaseFilePath: string) {
        this.databaseFilePath = databaseFilePath;
    }
    async initExtension() {
        if (!checkIsSQLiteSupported()) {
            throw new Error(
                `SQLite is not supported by this runtime (Node ${process.versions.node})`,
            );
        }
        const { DatabaseSync } = require('node:sqlite');
        const database = new DatabaseSync(this.databaseFilePath, {
            allowExtension: true,
        });
        const destLibFile = await getLibFilePath('fts5');
        database.loadExtension(destLibFile);
        // const destLibFile = getLibFilePath(databasePath, 'spellfix1');
        // database.loadExtension(destLibFile);
        this.database = database;
    }
    exec(sql: string) {
        this.database.exec(sql);
    }
    createTable(createTableSQL: string) {
        this.exec(createTableSQL);
    }
    getAll(sql: string) {
        const query = this.database.prepare(sql);
        return query.all();
    }
    close() {
        attemptClosing(this.database);
    }
}

const databaseUtils = {
    checkIsSupported() {
        return checkIsSQLiteSupported();
    },
    async getSQLiteDatabaseInstance(databaseFilePath: string) {
        const db = new SQLiteDatabase(databaseFilePath);
        await db.initExtension();
        return db;
    },
};

export default databaseUtils;
