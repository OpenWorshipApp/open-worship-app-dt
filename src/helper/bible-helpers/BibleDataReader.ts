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

const { base64Decode } = appProvider.appUtils;

export type BibleInfoType = {
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
};
export type BookList = { [key: string]: string };
export type VerseList = { [key: string]: string };
export type ChapterType = { title: string; verses: VerseList };

const bibleDataCacher = new CacheManager<BibleInfoType>(60); // 1 minute
export default class BibleDataReader {
    private _writableBiblePath: string | null = null;
    private _dbController: BibleDatabaseController | null = null;
    async getDatabaseController() {
        this._dbController ??= await BibleDatabaseController.getInstance();
        return this._dbController;
    }
    async readBibleData(bibleKey: string, key: string) {
        const cacheKey = `${bibleKey}-${key}`;
        return unlocking(cacheKey, async () => {
            const cachedData = await bibleDataCacher.get(cacheKey);
            if (cachedData !== null) {
                return cachedData;
            }
            const biblePath = await this.toBiblePath(bibleKey);
            if (biblePath === null) {
                return null;
            }
            const filePath = pathJoin(biblePath, key);
            const progressKey = `Reading bible data from "${filePath}"`;
            showProgressBar(progressKey);
            try {
                const databaseController = await this.getDatabaseController();
                const record =
                    await databaseController.getItem<string>(filePath);
                let b64Data: string | null = null;
                if (record !== null) {
                    b64Data = record.data;
                } else {
                    const fileData = await FileSource.readFileData(
                        filePath,
                        true,
                    );
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
                }
                const rawData = base64Decode(b64Data);
                const parsedData = JSON.parse(rawData) as BibleInfoType;
                await bibleDataCacher.set(cacheKey, parsedData);
                return parsedData;
            } catch (error: any) {
                if (error.code !== 'ENOENT') {
                    handleError(error);
                }
            } finally {
                hideProgressBar(progressKey);
            }
            return null;
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
