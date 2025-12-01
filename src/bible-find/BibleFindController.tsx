import { createContext, use } from 'react';
import { getBibleLocale } from '../helper/bible-helpers/bibleLogicHelpers2';
import { handleError } from '../helper/errorHelpers';
import FileSource from '../helper/FileSource';
import { appApiFetch } from '../helper/networkHelpers';
import {
    checkIsStopWord,
    LocaleType,
    quickEndWord,
    quickTrimText,
    sanitizeFindingText,
} from '../lang/langHelpers';
import appProvider, { SQLiteDatabaseType } from '../server/appProvider';
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
import {
    APIDataMapType,
    APIDataType,
    BibleFindForType,
    BibleFindResultType,
    calcPerPage,
    findOnline,
    SelectedBookKeyType,
} from './bibleFindHelpers';
import {
    AppContextMenuControlType,
    showAppContextMenu,
} from '../context-menu/appContextMenuHelpers';
import { cumulativeOffset } from '../helper/helpers';
import { unlocking } from '../server/unlockingHelpers';
import { pasteTextToInput } from '../server/appHelpers';
import { getSetting, setSetting } from '../helper/settingHelpers';
import { getBibleInfo } from '../helper/bible-helpers/bibleInfoHelpers';

const DEFAULT_ROW_LIMIT = 20;
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

async function initDatabase(
    bibleKey: string,
    databaseFilePath: string,
    successFileSuffix: string,
) {
    const databaseUtils = appProvider.databaseUtils;
    const databaseAdmin =
        await databaseUtils.getSQLiteDatabaseInstance(databaseFilePath);
    databaseAdmin.exec(`
        CREATE TABLE verses(text TEXT, sText TEXT);
        CREATE VIRTUAL TABLE spell USING fts5(text);
    `);
    const jsonData = await getBibleXMLDataFromKey(bibleKey);
    if (jsonData === null) {
        return null;
    }
    const sql = `INSERT INTO verses(text, sText) VALUES`;
    const locale = await getBibleLocale(bibleKey);
    const bucket = [];
    const words = new Set<string>();
    for (const [bookKey, book] of Object.entries(jsonData.books)) {
        console.log(`DB: Processing ${bookKey}`);
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
                            words.add(sanitizedWord);
                        }
                    }
                    sanitizedText = sanitizedText.split(' ').join('');
                }
                let text = `${bookKey}.${chapterKey}:${verse}=>${verses[verse]}`;
                text = text.replaceAll("'", "''");
                const sText = sanitizedText ?? verses[verse];
                bucket.push(`('${text}','${sText}')`);
                if (bucket.length > 100) {
                    databaseAdmin.exec(`${sql} ${bucket.join(',')};`);
                    bucket.length = 0;
                }
            }
        }
    }
    if (words.size > 0) {
        console.log(`DB: Inserting ${words.size} words`);
        databaseAdmin.exec(
            `INSERT INTO spell(text) VALUES ${Array.from(words)
                .map((word) => `('${word.split('').join(' ')}')`)
                .join(',')};`,
        );
    }
    await fsWriteFile(databaseFilePath + successFileSuffix, 'success');
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
    async loadSuggestionWords(_attemptingWord: string, _limit: number) {
        return [];
    }
}

class DatabaseFindingHandler {
    database: SQLiteDatabaseType;
    constructor(database: SQLiteDatabaseType) {
        this.database = database;
    }
    async doFinding(
        bibleKey: string,
        findData: BibleFindForType,
    ): Promise<BibleFindResultType | null> {
        // TODO: use dictionary to break text text to words.
        // e.g: Khmer language has no space between words so we need to break it to words
        const { bookKeys, text } = findData;
        if (!text) {
            return null;
        }
        let { fromLineNumber, toLineNumber } = findData;
        const locale = await getBibleLocale(bibleKey);
        const sText = (await sanitizeFindingText(locale, text)) ?? text;
        let sqlBookKey = '';
        if (bookKeys?.length) {
            const bookConditions = bookKeys
                .map((bookKey) => `text LIKE '${bookKey}%'`)
                .join(' OR ');
            sqlBookKey = ` AND (${bookConditions})`;
        }
        const wildCardText = sText
            .split(' ')
            .filter((part) => quickTrimText(locale, part))
            .filter((part) => part.length > 0)
            .map((part) => `%${part}%`)
            .join('');
        const sqlFrom = `FROM verses WHERE sText LIKE '%${wildCardText}%'${sqlBookKey}`;
        let sql = `SELECT text ${sqlFrom}`;
        if (fromLineNumber == undefined || toLineNumber == undefined) {
            fromLineNumber = 0;
            toLineNumber = DEFAULT_ROW_LIMIT - 1;
        }
        const count = calcPerPage(toLineNumber, fromLineNumber);
        if (count < 1) {
            throw new Error(`Invalid line number ${JSON.stringify(findData)}`);
        }
        sql += ` LIMIT ${fromLineNumber}, ${count}`;
        const result = this.database.getAll(sql);
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
        };
    }
    async loadSuggestionWords(
        attemptingWord: string,
        limit: number,
    ): Promise<string[]> {
        if (!attemptingWord) {
            return [];
        }
        const result = this.database.getAll(`
            SELECT text FROM spell
            WHERE text MATCH '${attemptingWord.split('').join(' ')}'
            ORDER BY bm25(spell) LIMIT ${limit};
        `);
        const mappedResult = result.map((item) =>
            item.text.split(' ').join(''),
        );
        if (mappedResult.includes(attemptingWord)) {
            mappedResult.splice(mappedResult.indexOf(attemptingWord), 1);
            mappedResult.unshift(attemptingWord);
        }
        return mappedResult;
    }
}

const BIBLE_FIND_SELECTED_BOOK_SETTING_NAME = 'bible-find-selected-book-key';

const instanceCache: Record<string, BibleFindController | null> = {};
const VERSIONS = ['', '1'];
export default class BibleFindController {
    onlineFindHandler: OnlineFindHandler | null = null;
    databaseFindHandler: DatabaseFindingHandler | null = null;
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
        const settingStr =
            getSetting(BIBLE_FIND_SELECTED_BOOK_SETTING_NAME) ?? '[]';
        try {
            return JSON.parse(settingStr) as string[];
        } catch (_error) {}
        return [];
    }
    set selectedBookKeys(bookKeys: string[]) {
        setSetting(
            BIBLE_FIND_SELECTED_BOOK_SETTING_NAME,
            JSON.stringify(bookKeys),
        );
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
        if (this.databaseFindHandler !== null) {
            return await this.databaseFindHandler.doFinding(
                this.bibleKey,
                findData,
            );
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

    static async checkDatabaseValid(filePath: string) {
        if (
            !(await fsCheckFileExist(filePath)) ||
            !(await fsCheckFileExist(filePath + SUCCESS_FILE_SUFFIX))
        ) {
            try {
                await fsDeleteFile(filePath);
                await fsDeleteFile(filePath + SUCCESS_FILE_SUFFIX);
            } catch (_error) {}
            return false;
        }
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
        let database: SQLiteDatabaseType | null = null;
        if (await this.checkDatabaseValid(databaseFilePath)) {
            const databaseUtils = appProvider.databaseUtils;
            database =
                await databaseUtils.getSQLiteDatabaseInstance(databaseFilePath);
        } else {
            database = await initDatabase(
                instance.bibleKey,
                databaseFilePath,
                SUCCESS_FILE_SUFFIX,
            );
        }
        if (database === null) {
            return null;
        }
        instance.databaseFindHandler = new DatabaseFindingHandler(database);
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
            const keysMap = await getAllXMLFileKeys();
            if (keysMap[bibleKey] === undefined) {
                instance = await this.getOnlineInstant(instance);
            } else {
                instance = await this.getXMLInstant(
                    instance,
                    keysMap[bibleKey],
                );
            }
            instanceCache[bibleKey] = instance;
            return instance as BibleFindController;
        });
    }

    async loadSuggestionWords(
        attemptingWord: string,
        limit = 5,
    ): Promise<string[]> {
        if (this.databaseFindHandler !== null) {
            return await this.databaseFindHandler.loadSuggestionWords(
                attemptingWord,
                limit,
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
                    menuElement: <span data-locale={this.locale}>{text}</span>,
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
            console.log('Closed suggestion menu');
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
