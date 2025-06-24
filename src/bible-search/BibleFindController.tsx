import { createContext, use } from 'react';
import { getBibleLocale } from '../helper/bible-helpers/serverBibleHelpers2';
import { handleError } from '../helper/errorHelpers';
import FileSource from '../helper/FileSource';
import { appApiFetch } from '../helper/networkHelpers';
import {
    LocaleType,
    quickEndWord,
    quickTrimText,
    sanitizeFindingText,
} from '../lang';
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
import {
    AppContextMenuControlType,
    ContextMenuItemType,
    showAppContextMenu,
} from '../context-menu/appContextMenuHelpers';
import { cumulativeOffset } from '../helper/helpers';

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
                const sanitizedText = await sanitizeFindingText(
                    locale,
                    verses[verse],
                );
                if (sanitizedText !== null) {
                    for (const word of sanitizedText.split(' ')) {
                        const sanitizedWord = quickTrimText(
                            locale,
                            word,
                        ).toLowerCase();
                        if (sanitizedWord) {
                            words.add(sanitizedWord);
                        }
                    }
                }
                let text = `${bookKey}.${chapterKey}:${verse}=>${verses[verse]}`;
                text = text.replace(/'/g, "''");
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
    async doFinding(bibleKey: string, findData: BibleFindForType) {
        // TODO: use dictionary to break text text to words.
        // e.g: Khmer language has no space between words so we need to break it to words
        const { bookKey, isFresh, text } = findData;
        if (!text) {
            return null;
        }
        let { fromLineNumber, toLineNumber } = findData;
        const locale = await getBibleLocale(bibleKey);
        const sText = (await sanitizeFindingText(locale, text)) ?? text;
        let sqlBookKey = '';
        if (bookKey !== undefined) {
            sqlBookKey = ` AND text LIKE '${bookKey}.%'`;
        }
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

export default class BibleFindController {
    onlineFindHandler: OnlineFindHandler | null = null;
    databaseFindHandler: DatabaseFindingHandler | null = null;
    private readonly _bibleKey: string;
    private _bookKey: string | null = null;
    input: HTMLInputElement | null = null;
    private _findText: string = '';
    locale: LocaleType;
    isAddedByEnter: boolean = false;
    onTextChange: () => void = () => {};
    private _oldInputText: string = '';
    menuControllerSession: AppContextMenuControlType | null = null;
    constructor(bibleKey: string, locale: LocaleType) {
        this._bibleKey = bibleKey;
        this.locale = locale;
    }

    get bookKey() {
        return this._bookKey;
    }
    set bookKey(value: string | null) {
        this._bookKey = value;
    }

    get findText() {
        return this._findText || (this.input?.value ?? '');
    }
    set findText(value: string | null) {
        if (this.input !== null) {
            this._findText = value ?? '';
            this._oldInputText = this.input.value;
            this.input.value = value ?? '';
            this.input.focus();
            this.onTextChange();
        }
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
        this.closeSuggestionMenu();
        if (this.bookKey !== null) {
            findData['bookKey'] = this.bookKey;
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

    static async getXMLInstant(
        instance: BibleFindController,
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
        instance.databaseFindHandler = new DatabaseFindingHandler(database);
        return instance;
    }

    static async getInstant(bibleKey: string) {
        const locale = await getBibleLocale(bibleKey);
        const instance = new BibleFindController(bibleKey, locale);
        const keysMap = await getAllXMLFileKeys();
        if (keysMap[bibleKey] === undefined) {
            return await BibleFindController.getOnlineInstant(instance);
        }
        return await BibleFindController.getXMLInstant(
            instance,
            keysMap[bibleKey],
        );
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

    private async handleDeletionFindText(text: string) {
        const sanitizedText = await sanitizeFindingText(this.locale, text);
        if (sanitizedText === null) {
            return;
        }
        const splitted = sanitizedText.split(' ');
        if (splitted.length < 2) {
            this._findText = '';
            return;
        }
        this._findText = splitted.slice(0, -1).join(' ');
    }

    private async checkLookupWord(event: any, lookupWord: string) {
        const suggestWords = await this.loadSuggestionWords(lookupWord, 100);
        if (!suggestWords.length) {
            return;
        }
        const { top, left } = cumulativeOffset(this.input);
        this.menuControllerSession = showAppContextMenu(
            event,
            suggestWords.map((text) => {
                return {
                    menuElement: <span data-locale={this.locale}>{text}</span>,
                    onSelect: (event: any) => {
                        if (event.key === 'Enter') {
                            this.isAddedByEnter = true;
                        }
                        this.findText = quickEndWord(
                            this.locale,
                            quickTrimText(
                                this.locale,
                                `${this._findText.trim()} ${text} `,
                            ),
                        );
                        this.input?.focus();
                    },
                } as ContextMenuItemType;
            }),
            {
                coord: { x: left, y: top + this.input!.offsetHeight },
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
            if (this.input !== null) {
                this.input.focus();
                const value = quickTrimText(this.locale, this.input.value);
                if (value) {
                    this.findText = quickEndWord(this.locale, value);
                }
            }
            this.menuControllerSession = null;
        });
    }

    async handleKeyUp(event: any) {
        const inputKey = event.key;
        const newValue = this.input?.value ?? '';
        if (this._oldInputText && this._oldInputText === newValue) {
            return;
        }
        this._oldInputText = newValue;
        this.closeSuggestionMenu();
        if (this.input === null) {
            return;
        }
        if (['Delete', 'Backspace'].includes(inputKey)) {
            await this.handleDeletionFindText(newValue);
        }
        const newTrimValue = quickTrimText(this.locale, this.input.value);
        if (newTrimValue !== newValue) {
            return;
        }
        const text = this._findText
            ? newTrimValue.split(this._findText)[1]
            : newTrimValue;
        if (!text) {
            return;
        }
        const sanitizedText = await sanitizeFindingText(this.locale, text);
        const lookupWord = (sanitizedText ?? '').split(' ').at(-1) ?? '';
        this.checkLookupWord(event, lookupWord);
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
