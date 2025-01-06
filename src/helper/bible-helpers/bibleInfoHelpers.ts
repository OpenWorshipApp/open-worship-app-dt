import appProvider from '../../server/appProvider';
import { fsCreateDir, fsReadFile, pathJoin } from '../../server/fileHelpers';
import { LocaleType } from '../../lang';
import { getUserWritablePath } from '../../server/appHelpers';
import { is_dev, decrypt } from '../../_owa-crypto/owa_crypto';
import { getKJVChapterCount, toBibleFileName } from './serverBibleHelpers';
import { handleError } from '../errorHelpers';
import {
    hideProgressBard, showProgressBard,
} from '../../progress-bar/progressBarHelpers';
import BibleDatabaseController from './BibleDatabaseController';

const { base64Decode } = appProvider.appUtils;

export type BibleInfoType = {
    title: string,
    key: string,
    locale: LocaleType,
    legalNote: string,
    publisher: string,
    copyRights: string,
    books: { [key: string]: string },
    numList?: string[],
    version: number,
};
export type BookList = { [key: string]: string };
export type VerseList = { [key: string]: string };
export type ChapterType = { title: string, verses: VerseList };

export async function getBookKVList(bibleKey: string) {
    const info = await getBibleInfo(bibleKey);
    if (info === null) {
        return null;
    }
    return info.books;
}
export async function keyToBook(bibleKey: string, bookKey: string) {
    const bookKVList = await getBookKVList(bibleKey);
    if (bookKVList === null) {
        return null;
    }
    return bookKVList[bookKey] || null;
}
export async function getBookVKList(bibleKey: string) {
    const bibleVKList = await getBookKVList(bibleKey);
    if (bibleVKList === null) {
        return null;
    }
    return Object.fromEntries(Object.entries(bibleVKList).map(([k, v]) => {
        return [v, k];
    }));
}
export async function bookToKey(bibleKey: string, book: string) {
    const bookVKList = await getBookVKList(bibleKey);
    if (bookVKList === null) {
        return null;
    }
    return bookVKList[book] || null;
}
export async function getChapterCount(bibleKey: string, book: string) {
    const bookKey = await bookToKey(bibleKey, book);
    if (bookKey === null) {
        return null;
    }
    const chapterCount = getKJVChapterCount(bookKey);
    return chapterCount;
}
export async function getBookChapterData(
    bibleKey: string, bookKey: string, chapter: number,
) {
    const chapterCount = getKJVChapterCount(bookKey);
    if (chapterCount === null || chapter > chapterCount) {
        return null;
    }
    const fileName = toBibleFileName(bookKey, chapter);
    const verseInfo = (
        await bibleDataReader.readBibleData(bibleKey, fileName) as
        ChapterType | null
    );
    if (verseInfo === null) {
        return null;
    }
    return verseInfo;
}
export async function getVerses(
    bibleKey: string, bookKey: string, chapter: number,
) {
    const chapterData = await getBookChapterData(bibleKey, bookKey, chapter);;
    return chapterData ? chapterData.verses : null;
}

type ReaderBibleDataType = BibleInfoType | null;
type CallbackType = (data: ReaderBibleDataType) => void;
export class BibleDataReader {
    private _writableBiblePath: string | null = null;
    private readonly callbackMapper: Map<string, Array<CallbackType>>;
    private _dbController: BibleDatabaseController | null = null;
    constructor() {
        this.callbackMapper = new Map();
    }
    private _pushCallback(key: string, callback: CallbackType) {
        const callbackList = this.callbackMapper.get(key) || [];
        callbackList.push(callback);
        this.callbackMapper.set(key, callbackList);
        return callbackList.length === 1;
    }
    private fullfilCallback(key: string, data: ReaderBibleDataType) {
        const callbackList = this.callbackMapper.get(key) || [];
        this.callbackMapper.delete(key);
        callbackList.forEach((callback) => {
            callback(data);
        });
    }
    async getDatabaseController() {
        if (this._dbController === null) {
            this._dbController = (
                await BibleDatabaseController.getInstance()
            );
        }
        return this._dbController;
    }
    async _readBibleData(filePath: string, bibleKey: string) {
        const progressKey = `Reading bible data from "${filePath}"`;
        showProgressBard(progressKey);
        let data = null;
        try {
            const databaseController = await this.getDatabaseController();
            const record = await databaseController.getItem<string>(filePath);
            let b64Data: string | null = null;
            if (record !== null) {
                b64Data = record.data;
            } else {
                const fileData = await fsReadFile(filePath);
                b64Data = decrypt(fileData);
                await databaseController.addItem({
                    id: filePath, data: b64Data, isForceOverride: true,
                    secondaryId: bibleKey,
                });
            }
            const rawData = base64Decode(b64Data);
            data = JSON.parse(rawData);
        } catch (error: any) {
            if (error.code !== 'ENOENT') {
                handleError(error);
            }
        } finally {
            hideProgressBard(progressKey);
        }
        return data;
    }
    async _genBibleData(
        bibleKey: string, key: string, callback: CallbackType,
    ) {
        const biblePath = await this.toBiblePath(bibleKey);
        if (biblePath === null) {
            return callback(null);
        }
        const filePath = pathJoin(biblePath, key);
        const isFist = this._pushCallback(filePath, callback);
        if (!isFist) {
            return;
        }
        const data = await this._readBibleData(filePath, bibleKey);
        this.fullfilCallback(filePath, data);
    }
    readBibleData(bibleKey: string, key: string) {
        return new Promise<ReaderBibleDataType>((resolve) => {
            this._genBibleData(bibleKey, key, resolve);
        });
    }
    async toBiblePath(bibleKey: string) {
        const writableBiblePath = await this.getWritableBiblePath();
        if (writableBiblePath === null) {
            return null;
        }
        return pathJoin(writableBiblePath, bibleKey);
    }
    async getWritableBiblePath() {
        if (this._writableBiblePath === null) {
            const userWritablePath = getUserWritablePath();
            const dirPath = pathJoin(userWritablePath,
                `bibles${is_dev() ? '-dev' : ''}`);
            try {
                await fsCreateDir(dirPath);
            } catch (error: any) {
                if (!error.message.includes('file already exists')) {
                    handleError(error);
                }
            }
            this._writableBiblePath = pathJoin(userWritablePath, 'bibles');
        }
        return this._writableBiblePath;
    }
    async clearBibleDatabaseData(bibleKey: string) {
        const dbController = await this.getDatabaseController();
        const keys = await dbController.getKeys(bibleKey);
        if (keys === null) {
            return;
        }
        Promise.all(
            keys.map(async (key) => {
                await dbController.deleteItem(key);
            }),
        );
    }
}
export const bibleDataReader = new BibleDataReader();

const bibleInfoMap = (
    new Map<string, { info: BibleInfoType, timestamp: number }>()
);
export async function getBibleInfo(bibleKey: string, isForce = false) {
    if (isForce) {
        bibleInfoMap.delete(bibleKey);
    }
    if (bibleInfoMap.has(bibleKey)) {
        const item = bibleInfoMap.get(bibleKey);
        const duration = 1000 * 10; // 10 seconds
        if (item && Date.now() - item.timestamp < duration) {
            return item.info;
        }
    }
    const info = await bibleDataReader.readBibleData(bibleKey, '_info');
    if (info !== null) {
        bibleInfoMap.set(bibleKey, { info, timestamp: Date.now() });
    }
    return info;
}
