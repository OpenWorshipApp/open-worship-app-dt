import { getBibleLocale } from '../helper/bible-helpers/bibleLogicHelpers2';
import { handleError } from '../helper/errorHelpers';
import FileSource from '../helper/FileSource';
import { appApiFetch } from '../helper/networkHelpers';
import { sanitizeFindingText } from '../lang/langHelpers';
import appProvider, { SQLiteDatabaseType } from '../server/appProvider';
import { fsCheckFileExist, pathJoin } from '../server/fileHelpers';
import { getBibleXMLDataFromKey } from '../setting/bible-setting/bibleXMLHelpers';
import { getAllXMLFileKeys } from '../setting/bible-setting/bibleXMLJsonDataHelpers';
import {
    APIDataMapType,
    APIDataType,
    BibleFindForType,
    BibleFindResultType,
    findOnline,
} from './bibleFindHelpers';

const DEFAULT_ROW_LIMIT = 20;

async function loadApiData() {
    try {
        const content = await appApiFetch('bible-online-info.json');
        const json = await content.json();
        if (typeof json.mapper !== 'object') {
            throw new Error('Cannot get bible list');
        }
        return json as APIDataType;
    } catch (error) {
        handleError(error);
    }
    return null;
}

async function initDatabase(bibleKey: string, databaseFilePath: string) {
    const databaseUtils = appProvider.databaseUtils;
    const databaseAdmin =
        await databaseUtils.getSQLiteDatabaseInstance(databaseFilePath);
    databaseAdmin.exec('CREATE TABLE verses(text TEXT, sText TEXT);');
    const jsonData = await getBibleXMLDataFromKey(bibleKey);
    if (jsonData === null) {
        return null;
    }
    const sql = `INSERT INTO verses(text, sText) VALUES`;
    const locale = await getBibleLocale(bibleKey);
    const bucket = [];
    const promises = [];
    for (const [bookKey, book] of Object.entries(jsonData.books)) {
        console.log(`DB: Processing ${bookKey}`);
        for (const [chapterKey, verses] of Object.entries(book)) {
            for (const verse in verses) {
                const sanitizedText = await sanitizeFindingText(
                    locale,
                    verses[verse],
                );
                const text = `${bookKey}.${chapterKey}:${verse}=>${verses[verse]}`;
                bucket.push(`('${text}','${sanitizedText ?? verses[verse]}')`);
                if (bucket.length >= 500) {
                    const sqlChunk = `${sql} ${bucket.join(',')};`;
                    promises.push(
                        new Promise((resolve) => {
                            databaseAdmin.exec(sqlChunk);
                            resolve(true);
                        }),
                    );
                    databaseAdmin.exec(`${sql} ${bucket.join(',')};`);
                    bucket.length = 0;
                }
            }
        }
    }
    await Promise.all(promises);
    return databaseAdmin;
}

class OnlineFindHandler {
    apiDataMap: APIDataMapType;
    constructor(apiDataMap: APIDataMapType) {
        this.apiDataMap = apiDataMap;
    }
    async doFinding(findData: BibleFindForType) {
        const data = await findOnline(
            this.apiDataMap.apiUrl,
            this.apiDataMap.apiKey,
            findData,
        );
        return data;
    }
}

class DatabaseFindHandler {
    database: SQLiteDatabaseType;
    constructor(database: SQLiteDatabaseType) {
        this.database = database;
    }
    async doFinding(bibleKey: string, findData: BibleFindForType) {
        const { bookKeys, isFresh, text } = findData;
        let { fromLineNumber, toLineNumber } = findData;
        const locale = await getBibleLocale(bibleKey);
        const sText = (await sanitizeFindingText(locale, text)) ?? text;
        const sqlBookKey =
            bookKeys !== undefined
                ? ` AND bookKey IN (${bookKeys.join(',')})`
                : '';
        const sqlFrom = `FROM verses WHERE sText LIKE '%${sText}%'${sqlBookKey}`;
        let sql = `SELECT text ${sqlFrom}`;
        if (fromLineNumber == undefined || toLineNumber == undefined) {
            fromLineNumber = 1;
            toLineNumber = DEFAULT_ROW_LIMIT;
        }
        const count = toLineNumber - fromLineNumber + 1;
        if (count < 1) {
            throw new Error(`Invalid line number ${JSON.stringify(findData)}`);
        }
        sql += ` LIMIT ${fromLineNumber}, ${count}`;
        const result = this.database.getAll(`${sql};`);
        const foundResult = result.map((item) => {
            const splitted = item.text.split('=>');
            return {
                uniqueKey: crypto.randomUUID(),
                text: `${splitted[0]}:${splitted[1]}`,
            };
        });
        let maxLineNumber = 0;
        const countResult = this.database.getAll(
            `SELECT COUNT(*) as count ${sqlFrom};`,
        );
        if (countResult.length > 0) {
            maxLineNumber = countResult[0].count;
        }
        return {
            maxLineNumber,
            fromLineNumber,
            toLineNumber,
            content: foundResult,
            isFresh,
        } as BibleFindResultType;
    }
}

export default class BibleFindControllerBase {
    onlineFindHandler: OnlineFindHandler | null = null;
    databaseFindHandler: DatabaseFindHandler | null = null;
    private readonly _bibleKey: string;
    private _bookKeys: string[] = [];
    constructor(bibleKey: string) {
        this._bibleKey = bibleKey;
    }

    get bookKeys() {
        return this._bookKeys;
    }
    set bookKeys(value: string[]) {
        this._bookKeys = value;
    }

    get bibleKey() {
        return this._bibleKey;
    }

    async doFinding(findData: BibleFindForType) {
        if (this.bookKeys !== null) {
            findData['bookKeys'] = this.bookKeys;
        }
        if (this.onlineFindHandler !== null) {
            return await this.onlineFindHandler.doFinding(findData);
        }
        if (this.databaseFindHandler !== null) {
            return await this.databaseFindHandler.doFinding(
                this.bibleKey,
                findData,
            );
        }
        return null;
    }

    static async getOnlineInstant(instance: BibleFindControllerBase) {
        const apiData = await loadApiData();
        if (apiData === null) {
            return null;
        }
        const apiDataMap = apiData.mapper[instance.bibleKey];
        if (apiDataMap === undefined) {
            return null;
        }
        instance.onlineFindHandler = new OnlineFindHandler(apiDataMap);
        return instance;
    }

    static async getXMLInstant(
        instance: BibleFindControllerBase,
        xmlFilePath: string,
    ) {
        const fileSource = FileSource.getInstance(xmlFilePath);
        const databasePath = pathJoin(
            fileSource.basePath,
            `${fileSource.name}.db`,
        );
        let database: SQLiteDatabaseType | null = null;
        if (!(await fsCheckFileExist(databasePath))) {
            database = await initDatabase(instance.bibleKey, databasePath);
        } else {
            const databaseUtils = appProvider.databaseUtils;
            database =
                await databaseUtils.getSQLiteDatabaseInstance(databasePath);
        }
        if (database === null) {
            return null;
        }
        instance.databaseFindHandler = new DatabaseFindHandler(database);
        return instance;
    }

    static async getInstant(bibleKey: string) {
        const instance = new BibleFindControllerBase(bibleKey);
        const keysMap = await getAllXMLFileKeys();
        if (keysMap[bibleKey] === undefined) {
            return await BibleFindControllerBase.getOnlineInstant(instance);
        }
        return await BibleFindControllerBase.getXMLInstant(
            instance,
            keysMap[bibleKey],
        );
    }
}
