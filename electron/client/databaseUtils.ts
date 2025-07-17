/* eslint-disable @typescript-eslint/no-unused-vars */
import { dirname, join, resolve } from 'node:path';
import { copyFileSync, existsSync } from 'node:fs';
import { promises } from 'node:fs';
import {
    isWindows,
    isMac,
    attemptClosing,
    toUnpackedPath,
} from '../electronHelpers';

// https://nodejs.org/docs/latest-v22.x/api/sqlite.html

async function checkIsSameFiles(fname1, fname2) {
    const kReadSize = 1024 * 8;
    let h1, h2;
    try {
        h1 = await promises.open(fname1);
        h2 = await promises.open(fname2);
        const [stat1, stat2] = await Promise.all([h1.stat(), h2.stat()]);
        if (stat1.size !== stat2.size) {
            return false;
        }
        const buf1 = Buffer.alloc(kReadSize);
        const buf2 = Buffer.alloc(kReadSize);
        let pos = 0;
        let remainingSize = stat1.size;
        while (remainingSize > 0) {
            const readSize = Math.min(kReadSize, remainingSize);
            const [r1, r2] = await Promise.all([
                h1.read(buf1, 0, readSize, pos),
                h2.read(buf2, 0, readSize, pos),
            ]);
            if (r1.bytesRead !== readSize || r2.bytesRead !== readSize) {
                throw new Error('Failed to read desired number of bytes');
            }
            if (buf1.compare(buf2, 0, readSize, 0, readSize) !== 0) {
                return false;
            }
            remainingSize -= readSize;
            pos += readSize;
        }
        return true;
    } finally {
        if (h1) {
            await h1.close();
        }
        if (h2) {
            await h2.close();
        }
    }
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
