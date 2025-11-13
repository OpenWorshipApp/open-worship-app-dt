import appProvider from '../../server/appProvider';
import { fsCreateDir, pathJoin } from '../../server/fileHelpers';
import { LocaleType } from '../../lang/langHelpers';
import { decrypt } from '../../_owa-crypto';
import { handleError } from '../errorHelpers';
import {
    hideProgressBar,
    showProgressBar,
} from '../../progress-bar/progressBarHelpers';
import BibleDatabaseController from './BibleDatabaseController';
import FileSource from '../FileSource';
import CacheManager from '../../others/CacheManager';
import { appLocalStorage } from '../../setting/directory-setting/appLocalStorage';
import { unlocking } from '../../server/unlockingHelpers';
import { checkIsBibleXML } from './bibleInfoHelpers';
import { readBibleXMLData } from '../../setting/bible-setting/bibleXMLHelpers';

const { base64Decode } = appProvider.appUtils;

export type BibleInfoType = Readonly<{
    title: string;
    key: string;
    locale: LocaleType;
    legalNote: string;
    publisher: string;
    copyRights: string;
    books: { [key: string]: string };
    booksAvailable: string[];
    numList?: string[];
    version: number;
    newLines?: string[];
}>;
export type BookList = { [key: string]: string };
export type BibleVerseList = { [key: string]: string };
export type BibleChapterType = { title: string; verses: BibleVerseList };

const bibleDataCacher = new CacheManager<BibleInfoType | BibleChapterType>(60); // 1 minute
export default class BibleDataReader {
    private _writableBiblePath: string | null = null;
    private _dbController: BibleDatabaseController | null = null;

    async getDatabaseController() {
        this._dbController ??= await BibleDatabaseController.getInstance();
        return this._dbController;
    }

    async readBibleDownloadedData(bibleKey: string, key: string) {
        const biblePath = await this.toBiblePath(bibleKey);
        if (biblePath === null) {
            return null;
        }
        const filePath = pathJoin(biblePath, key);
        const progressKey = `Reading bible data from "${filePath}"`;
        showProgressBar(progressKey);
        try {
            const databaseController = await this.getDatabaseController();
            const record = await databaseController.getItem<string>(filePath);
            let b64Data: string | null = null;
            if (record === null) {
                const fileData = await FileSource.readFileData(filePath, true);
                if (fileData === null) {
                    return null;
                }
                b64Data = decrypt(fileData);
                await databaseController.addItem({
                    id: filePath,
                    data: b64Data,
                    isForceOverride: true,
                    secondaryId: bibleKey,
                });
            } else {
                b64Data = record.data;
            }
            const rawData = base64Decode(b64Data);
            const parsedData = JSON.parse(rawData) as
                | BibleInfoType
                | BibleChapterType;
            return parsedData;
        } catch (error: any) {
            if (error.code !== 'ENOENT') {
                handleError(error);
            }
        } finally {
            hideProgressBar(progressKey);
        }
        return null;
    }

    async readBibleData(bibleKey: string, key: string) {
        const cacheKey = `${bibleKey}-${key}`;
        return unlocking(cacheKey, async () => {
            const cachedData = await bibleDataCacher.get(cacheKey);
            if (cachedData !== null) {
                return cachedData;
            }
            let bibleData: any = null;
            const isBibleXML = await checkIsBibleXML(bibleKey);
            if (isBibleXML) {
                bibleData = await readBibleXMLData(bibleKey, key);
            } else {
                bibleData = await this.readBibleDownloadedData(bibleKey, key);
            }
            if (bibleData === null) {
                return null;
            }
            await bibleDataCacher.set(cacheKey, bibleData);
            return bibleData;
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
            const userWritablePath = appLocalStorage.defaultStorage;
            const dirPath = pathJoin(userWritablePath, 'bibles-data');
            try {
                await fsCreateDir(dirPath);
            } catch (error: any) {
                if (!error.message.includes('file already exists')) {
                    handleError(error);
                }
            }
            this._writableBiblePath = dirPath;
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
