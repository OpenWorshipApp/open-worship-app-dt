import { createContext, use } from 'react';

import { handleError } from '../helper/errorHelpers';
import FileSource from '../helper/FileSource';
import { appApiFetch } from '../helper/networkHelpers';
import type { LocaleType } from '../lang/langHelpers';
import {
    checkIsStopWord,
    quickEndWord,
    quickTrimText,
    sanitizeFindingText,
} from '../lang/langHelpers';
import type { SQLiteDatabaseType } from '../server/appProvider';
import appProvider from '../server/appProvider';
import {
    fsCheckFileExist,
    fsDeleteFile,
    fsWriteFile,
    pathJoin,
} from '../server/fileHelpers';
import {
    ensureBibleXMLCachedBasePath,
    getBibleXMLDataFromKey,
} from '../setting/bible-setting/bibleXMLHelpers';
import {
    getAllXMLFileKeys,
    xmlTextToJson,
} from '../setting/bible-setting/bibleXMLJsonDataHelpers';
import type {
    APIDataMapType,
    APIDataType,
    BibleFindForType,
    BibleFindResultType,
    SelectedBookKeyType,
} from './bibleFindHelpers';
import { findOnline } from './bibleFindHelpers';
import { prepareFindQuery, toFoundVerseItem } from './bibleFindQueryHelpers';
import { finishSuggestionWords } from './suggestionWordHelpers';
import type { PlainFindIndexType } from './PlainFindHandler';
import PlainFindHandler, { toLikeLowerText } from './PlainFindHandler';
import type { AppContextMenuControlType } from '../context-menu/appContextMenuHelpers';
import { showAppContextMenu } from '../context-menu/appContextMenuHelpers';
import { genContextMenuItemIcon } from '../context-menu/contextMenuIconHelpers';
import { cumulativeOffset } from '../helper/helpers';
import { unlocking } from '../server/unlockingHelpers';
import { pasteTextToInput } from '../server/appHelpers';
import { genStringListSettingManager } from '../helper/SettingManager';
import { getBibleInfo } from '../helper/bible-helpers/bibleInfoHelpers';
import { appLog } from '../helper/loggerHelpers';
import { getBibleLocale } from '../helper/bible-helpers/bibleStyleHelpers';

const SUCCESS_FILE_SUFFIX = '-success';

async function loadApiData() {
    try {
        const content = await appApiFetch('bible-online-info.json');
        const json = await content.json();
        if (typeof json.mapper !== 'object') {
            throw new TypeError('Cannot get bible list');
        }
        return json as APIDataType;
    } catch (error) {
        handleError(error);
    }
    return null;
}

function flushBucket(
    databaseAdmin: SQLiteDatabaseType,
    sql: string,
    bucket: string[],
) {
    databaseAdmin.exec(`${sql} ${bucket.join(',')};`);
    bucket.length = 0;
}

/**
 * Every verse of a Bible as its stored row and sanitized text, handed to
 * `onVerse` one at a time so the SQLite build can write in small batches;
 * returns the suggestion words with the books holding each, or `null` when
 * the Bible has no data.
 */
async function forEachSearchingVerse(
    bibleKey: string,
    onVerse: (text: string, sText: string) => void,
) {
    const jsonData = await getBibleXMLDataFromKey(bibleKey);
    if (jsonData === null) {
        return null;
    }
    const locale = await getBibleLocale(bibleKey);
    const words: { [key: string]: Set<string> } = {};
    for (const [bookKey, book] of Object.entries(jsonData.books)) {
        appLog(`DB: Processing ${bookKey}`);
        for (const [chapterKey, verses] of Object.entries(book)) {
            for (const verse in verses) {
                let sanitizedText = await sanitizeFindingText(
                    locale,
                    verses[verse],
                );
                if (sanitizedText !== null) {
                    for (const word of sanitizedText.split(' ')) {
                        const sanitizedWord = quickTrimText(
                            locale,
                            word,
                        ).toLowerCase();
                        if (
                            sanitizedWord.length > 1 &&
                            !checkIsStopWord(locale, sanitizedWord)
                        ) {
                            words[sanitizedWord] ??= new Set();
                            words[sanitizedWord].add(bookKey);
                        }
                    }
                    sanitizedText = sanitizedText.split(' ').join('');
                }
                onVerse(
                    `${bookKey}.${chapterKey}:${verse}=>${verses[verse]}`,
                    sanitizedText ?? verses[verse],
                );
            }
        }
    }
    return words;
}

async function initSearchingDatabase(
    bibleKey: string,
    databaseFilePath: string,
    successFileSuffix: string,
) {
    const databaseUtils = appProvider.databaseUtils;
    const databaseAdmin =
        await databaseUtils.getSQLiteDatabaseInstance(databaseFilePath);
    databaseAdmin.exec(`
        CREATE TABLE verses(text TEXT, sText TEXT);
        CREATE VIRTUAL TABLE spell USING fts5(text, bookKeys);
    `);
    const sql = `INSERT INTO verses(text, sText) VALUES`;
    const bucket: string[] = [];
    const words = await forEachSearchingVerse(bibleKey, (text, sText) => {
        bucket.push(`('${text.replaceAll("'", "''")}','${sText}')`);
        if (bucket.length > 100) {
            flushBucket(databaseAdmin, sql, bucket);
        }
    });
    if (words === null) {
        return null;
    }
    if (bucket.length > 0) {
        flushBucket(databaseAdmin, sql, bucket);
    }
    const wordsLength = Object.keys(words).length;
    if (wordsLength > 0) {
        appLog(`DB: Inserting ${wordsLength} words`);
        const values = Object.entries(words)
            .map(([word, bookKeys]) => {
                const text = word.split('').join(' ');
                const bookKeysStr = Array.from(bookKeys).join(' ');
                return `('${text}', '${bookKeysStr}')`;
            })
            .join(',');
        databaseAdmin.exec(
            `INSERT INTO spell(text, bookKeys) VALUES ${values};`,
        );
    }
    await fsWriteFile(databaseFilePath + successFileSuffix, 'success');
    return databaseAdmin;
}

/** The plain fallback index (no `node:sqlite`), written beside the `.db`. */
async function initPlainSearchingIndex(
    bibleKey: string,
    indexFilePath: string,
    successFileSuffix: string,
) {
    const verses: PlainFindIndexType['verses'] = [];
    const words = await forEachSearchingVerse(bibleKey, (text, sText) => {
        verses.push([text, toLikeLowerText(sText)]);
    });
    if (words === null) {
        return null;
    }
    const data: PlainFindIndexType = {
        verses,
        words: Object.entries(words).map(([word, bookKeys]) => {
            return [word, Array.from(bookKeys).join(' ')];
        }),
    };
    appLog(`DB: Writing plain index of ${verses.length} verses`);
    await fsWriteFile(indexFilePath, JSON.stringify(data));
    await fsWriteFile(indexFilePath + successFileSuffix, 'success');
    return data;
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
    async loadSuggestionWords(_attemptingWord: string, _limit: number) {
        return [];
    }
}

class DatabaseFindingHandler {
    database: SQLiteDatabaseType;
    constructor(database: SQLiteDatabaseType) {
        this.database = database;
    }
    close() {
        this.database.close();
    }
    async doFinding(
        bibleKey: string,
        findData: BibleFindForType,
    ): Promise<BibleFindResultType | null> {
        const query = await prepareFindQuery(bibleKey, findData);
        if (query === null) {
            return null;
        }
        const { fromLineNumber, toLineNumber, count, wildCardText } = query;
        const { bookKeys } = findData;
        let sqlBookKey = '';
        if (bookKeys?.length) {
            const bookConditions = bookKeys
                .map((bookKey) => `text LIKE '${bookKey}%'`)
                .join(' OR ');
            sqlBookKey = ` AND (${bookConditions})`;
        }
        const sqlFrom = `FROM verses WHERE sText LIKE '%${wildCardText}%'${sqlBookKey}`;
        const sql = `SELECT text ${sqlFrom} LIMIT ${fromLineNumber}, ${count}`;
        const result = this.database.getAll(sql);
        const foundResult = result.map((item) => {
            return toFoundVerseItem(item.text);
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
        };
    }
    async loadSuggestionWords(
        attemptingWord: string,
        limit: number,
        bookKeys: string[] = [],
    ): Promise<string[]> {
        if (!attemptingWord) {
            return [];
        }
        const result = this.database.getAll(`
            SELECT text, bookKeys FROM spell
            WHERE text MATCH '${attemptingWord.split('').join(' ')}'
            ORDER BY bm25(spell);
        `);
        return finishSuggestionWords(
            result.map(({ text, bookKeys: foundBookKeys }) => {
                return {
                    text: text.split(' ').join(''),
                    bookKeys: foundBookKeys,
                };
            }),
            attemptingWord,
            limit,
            bookKeys,
        );
    }
}

const selectedBookSettingManager = genStringListSettingManager(
    'bible-find-selected-book-key',
);

const instanceCache: Record<string, BibleFindController | null> = {};
const VERSIONS = ['', '1', '2'];
export default class BibleFindController {
    onlineFindHandler: OnlineFindHandler | null = null;
    databaseFindHandler: DatabaseFindingHandler | null = null;
    plainFindHandler: PlainFindHandler | null = null;
    private readonly _bibleKey: string;
    locale: LocaleType;
    menuControllerSession: AppContextMenuControlType | null = null;
    static readonly findingContext: {
        bibleKey: string | null;
        findingText: string | null;
    } = {
        bibleKey: null,
        findingText: null,
    };

    constructor(bibleKey: string, locale: LocaleType) {
        this._bibleKey = bibleKey;
        this.locale = locale;
    }

    get selectedBookKeys() {
        return selectedBookSettingManager.getSetting();
    }
    set selectedBookKeys(bookKeys: string[]) {
        selectedBookSettingManager.setSetting(bookKeys);
    }

    async getSelectedBooks() {
        const bookKeys = this.selectedBookKeys;
        const books: SelectedBookKeyType[] = (
            await Promise.all(
                bookKeys.map(async (bookKey) => {
                    const bibleInfo = await getBibleInfo(this.bibleKey);
                    if (bibleInfo === null) {
                        return null;
                    }
                    return {
                        bookKey,
                        book: bibleInfo.keyBookMap[bookKey] ?? bookKey,
                    };
                }),
            )
        ).filter((item) => item !== null);
        return books;
    }

    get bibleKey() {
        return this._bibleKey;
    }

    closeSuggestionMenu() {
        if (this.menuControllerSession !== null) {
            this.menuControllerSession.closeMenu();
            this.menuControllerSession = null;
        }
    }

    async doFinding(findData: BibleFindForType) {
        findData['bookKeys'] = this.selectedBookKeys;
        if (this.onlineFindHandler !== null) {
            return await this.onlineFindHandler.doFinding(findData);
        }
        const localFindHandler =
            this.databaseFindHandler ?? this.plainFindHandler;
        if (localFindHandler !== null) {
            return await localFindHandler.doFinding(this.bibleKey, findData);
        }
        return null;
    }

    static async getOnlineInstant(instance: BibleFindController) {
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

    static async getDatabaseFilePath(xmlFilePath: string) {
        const versions = [...VERSIONS];
        const xmlText = await FileSource.readFileData(xmlFilePath);
        if (xmlText === null) {
            return null;
        }
        const bibleInfo = await xmlTextToJson(xmlText);
        if (bibleInfo === null) {
            return null;
        }
        const basePath = await ensureBibleXMLCachedBasePath(bibleInfo.info.key);
        if (basePath === null) {
            return null;
        }
        const fileSource = FileSource.getInstance(xmlFilePath);
        const databaseFilePath = pathJoin(
            basePath,
            `${fileSource.name}${versions.at(-1)}.db`,
        );
        return databaseFilePath;
    }

    static toPlainIndexFilePath(dbFilePath: string) {
        return dbFilePath.replace(/\.db$/, '') + '.plain.json';
    }

    static toSearchingDatabaseSuccessFilePath(dbFilePath: string) {
        return dbFilePath + SUCCESS_FILE_SUFFIX;
    }

    static async checkSearchingDatabaseValid(filePath: string) {
        const successFilePath =
            this.toSearchingDatabaseSuccessFilePath(filePath);
        if (
            !(await fsCheckFileExist(filePath)) ||
            !(await fsCheckFileExist(successFilePath))
        ) {
            try {
                await fsDeleteFile(filePath);
                await fsDeleteFile(successFilePath);
            } catch (_error) {}
            return false;
        }
        return true;
    }

    static async getXMLFilePath(bibleKey: string) {
        const keysMap = await getAllXMLFileKeys();
        if (keysMap[bibleKey] === undefined) {
            return null;
        }
        return keysMap[bibleKey] ?? null;
    }

    static async getSearchingDatabaseFilePath(bibleKey: string) {
        const xmlFilePath = await this.getXMLFilePath(bibleKey);
        if (xmlFilePath === null) {
            return null;
        }
        const databaseFilePath = await this.getDatabaseFilePath(xmlFilePath);
        return databaseFilePath;
    }

    static async resetSearchingDatabase(bibleKey: string) {
        const databaseFilePath =
            await this.getSearchingDatabaseFilePath(bibleKey);
        if (databaseFilePath === null) {
            return false;
        }
        const cachedInstance = instanceCache[bibleKey];
        try {
            await fsDeleteFile(
                this.toSearchingDatabaseSuccessFilePath(databaseFilePath),
            );
            await fsDeleteFile(
                this.toSearchingDatabaseSuccessFilePath(
                    this.toPlainIndexFilePath(databaseFilePath),
                ),
            );
        } catch (error) {
            handleError(error);
            return false;
        }
        try {
            cachedInstance?.databaseFindHandler?.close();
            cachedInstance?.plainFindHandler?.close();
        } catch (error) {
            handleError(error);
        }
        if (cachedInstance) {
            cachedInstance.databaseFindHandler = null;
            cachedInstance.plainFindHandler = null;
        }
        delete instanceCache[bibleKey];
        return true;
    }

    static async getXMLInstant(
        instance: BibleFindController,
        xmlFilePath: string,
    ) {
        const databaseFilePath = await this.getDatabaseFilePath(xmlFilePath);
        if (databaseFilePath === null) {
            return null;
        }
        if (!appProvider.databaseUtils.checkIsSupported()) {
            // No `node:sqlite` (Electron 32 / Node 20): the plain find.
            return await this.getPlainInstant(instance, databaseFilePath);
        }
        let searchingDatabase: SQLiteDatabaseType | null;
        if (await this.checkSearchingDatabaseValid(databaseFilePath)) {
            const databaseUtils = appProvider.databaseUtils;
            searchingDatabase =
                await databaseUtils.getSQLiteDatabaseInstance(databaseFilePath);
        } else {
            searchingDatabase = await initSearchingDatabase(
                instance.bibleKey,
                databaseFilePath,
                SUCCESS_FILE_SUFFIX,
            );
        }
        if (searchingDatabase === null) {
            return null;
        }
        instance.databaseFindHandler = new DatabaseFindingHandler(
            searchingDatabase,
        );
        return instance;
    }

    static async getPlainInstant(
        instance: BibleFindController,
        databaseFilePath: string,
    ) {
        const indexFilePath = this.toPlainIndexFilePath(databaseFilePath);
        let data: PlainFindIndexType | null = null;
        if (!(await this.checkSearchingDatabaseValid(indexFilePath))) {
            data = await initPlainSearchingIndex(
                instance.bibleKey,
                indexFilePath,
                SUCCESS_FILE_SUFFIX,
            );
            if (data === null) {
                return null;
            }
        }
        instance.plainFindHandler = new PlainFindHandler(indexFilePath, data);
        return instance;
    }

    static async getInstant(bibleKey: string) {
        return unlocking(`bible-find-controller-${bibleKey}`, async () => {
            if (instanceCache[bibleKey]) {
                return instanceCache[bibleKey];
            }
            const locale = await getBibleLocale(bibleKey);
            let instance: BibleFindController | null = new this(
                bibleKey,
                locale,
            );
            const xmlFilePath = await this.getXMLFilePath(bibleKey);
            if (xmlFilePath === null) {
                instance = await this.getOnlineInstant(instance);
            } else {
                instance = await this.getXMLInstant(instance, xmlFilePath);
            }
            instanceCache[bibleKey] = instance;
            return instance as BibleFindController;
        });
    }

    async loadSuggestionWords(
        attemptingWord: string,
        limit = 5,
    ): Promise<string[]> {
        const localFindHandler =
            this.databaseFindHandler ?? this.plainFindHandler;
        if (localFindHandler !== null) {
            const bookKeys = await this.getSelectedBooks();
            return await localFindHandler.loadSuggestionWords(
                attemptingWord,
                limit,
                bookKeys.map(({ bookKey }) => bookKey),
            );
        }
        if (this.onlineFindHandler !== null) {
            return await this.onlineFindHandler.loadSuggestionWords(
                attemptingWord,
                limit,
            );
        }
        return [];
    }

    private async checkLookupWord(
        event: any,
        input: HTMLInputElement,
        oldValue: string,
        lookupWord: string,
    ) {
        const suggestWords = await this.loadSuggestionWords(lookupWord, 100);
        if (!suggestWords.length) {
            return;
        }
        const { top, left } = cumulativeOffset(input);
        this.menuControllerSession = showAppContextMenu(
            event,
            suggestWords.map((text) => {
                return {
                    childBefore: genContextMenuItemIcon('search'),
                    menuElement: (
                        <span data-locale-ff={this.locale}>{text}</span>
                    ),
                    onSelect: () => {
                        let newText = quickEndWord(this.locale, oldValue);
                        const trimText = quickTrimText(this.locale, text);
                        newText = quickEndWord(this.locale, newText + trimText);
                        pasteTextToInput(input, newText);
                    },
                };
            }),
            {
                coord: { x: left, y: top + input.offsetHeight },
                maxHeigh: 200,
                style: {
                    backgroundColor: 'rgba(128, 128, 128, 0.4)',
                    backdropFilter: 'blur(5px)',
                    opacity: 0.9,
                },
                noKeystroke: true,
                applyOnTab: true,
            },
        );
        this.menuControllerSession.promiseDone.then(() => {
            appLog('Closed suggestion menu');
        });
    }

    async handleNewValue(event: any) {
        const input = event.target;
        if (input instanceof HTMLInputElement === false) {
            return;
        }
        const value = input.value ?? '';
        this.closeSuggestionMenu();
        const newTrimValue = quickTrimText(this.locale, input.value);
        if (!newTrimValue || newTrimValue !== value) {
            return;
        }
        const sanitizedText = await sanitizeFindingText(this.locale, value);
        const lookupWord = (sanitizedText ?? '').split(' ').at(-1) ?? '';
        if (!lookupWord) {
            return;
        }
        const oldValue = value.substring(0, value.length - lookupWord.length);
        this.checkLookupWord(event, input, oldValue, lookupWord);
    }
}

export const BibleFindControllerContext =
    createContext<BibleFindController | null>(null);
export function useBibleFindController() {
    const context = use(BibleFindControllerContext);
    if (context === null) {
        throw new Error(
            'useBibleFindController must be used within BibleFindControllerContext',
        );
    }
    return context;
}
