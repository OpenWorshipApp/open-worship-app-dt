/* eslint-disable @typescript-eslint/no-unused-vars */
import { join } from 'node:path';
import {
    isWindows,
    isMac,
    attemptClosing,
    toUnpackedPath,
} from '../electronHelpers';

// https://nodejs.org/docs/latest-v22.x/api/sqlite.html

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
    databasePath: string;
    constructor(databasePath: string) {
        this.databasePath = databasePath;
    }
    async initExtension() {
        const { DatabaseSync } = require('node:sqlite');
        const database = new DatabaseSync(this.databasePath, {
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
    async getSQLiteDatabaseInstance(databaseName: string) {
        const db = new SQLiteDatabase(databaseName);
        await db.initExtension();
        return db;
    },
};

export default databaseUtils;
