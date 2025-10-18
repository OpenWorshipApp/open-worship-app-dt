import {
    getKJVChapterCount,
    kjvBibleInfo,
    toBibleFileName,
} from './serverBibleHelpers';
import { bibleKeyToXMLFilePath } from '../../setting/bible-setting/bibleXMLJsonDataHelpers';
import {
    bibleDataReader,
    BibleInfoType,
    BibleChapterType,
} from './BibleDataReader';
import { fsCheckFileExist } from '../../server/fileHelpers';
import {
    hideProgressBar,
    showProgressBar,
} from '../../progress-bar/progressBarHelpers';
import CacheManager from '../../others/CacheManager';
import { freezeObject } from '../helpers';

export async function checkIsBookAvailable(bibleKey: string, bookKey: string) {
    const info = await getBibleInfo(bibleKey);
    if (info === null) {
        return false;
    }
    return info.booksAvailable.includes(bookKey);
}

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
    return bookKVList[bookKey] ?? null;
}
export async function getBookVKList(bibleKey: string) {
    const bibleVKList = await getBookKVList(bibleKey);
    if (bibleVKList === null) {
        return null;
    }
    return Object.fromEntries([
        ...Object.entries(bibleVKList).map(([k, v]) => {
            return [v, k];
        }),
        ...Object.entries(bibleVKList).map(([k, v]) => {
            return [v.toLocaleLowerCase(), k];
        }),
    ]);
}
export async function bookToKey(bibleKey: string, book: string) {
    const bookVKList = await getBookVKList(bibleKey);
    if (bookVKList === null) {
        return null;
    }
    return bookVKList[book.toLocaleLowerCase()] ?? null;
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
    bibleKey: string,
    bookKey: string,
    chapter: number,
) {
    const chapterCount = getKJVChapterCount(bookKey);
    if (chapterCount === null || chapter > chapterCount) {
        return null;
    }
    const fileName = toBibleFileName(bookKey, chapter);
    const verseInfo = (await bibleDataReader.readBibleData(
        bibleKey,
        fileName,
    )) as BibleChapterType | null;
    if (verseInfo === null) {
        return null;
    }
    return verseInfo;
}
export async function getVerses(
    bibleKey: string,
    bookKey: string,
    chapter: number,
) {
    const chapterData = await getBookChapterData(bibleKey, bookKey, chapter);
    return chapterData ? chapterData.verses : null;
}

export async function checkIsBibleXML(bibleKey: string) {
    const xmlFilePath = await bibleKeyToXMLFilePath(bibleKey);
    if (xmlFilePath === null || !(await fsCheckFileExist(xmlFilePath))) {
        return false;
    }
    return true;
}

function checkIsBooksAvailableMissing(info: BibleInfoType) {
    return (
        (info as any).filePath !== undefined &&
        info.booksAvailable === undefined
    );
}

export function checkIsOldTestament(bookKey: string) {
    return kjvBibleInfo.bookKeysOld.includes(bookKey);
}

const cache = new CacheManager<BibleInfoType>(60); // cache for 1 minutes
export async function getBibleInfo(
    bibleKey: string,
    isForce = false,
): Promise<BibleInfoType | null> {
    if (isForce) {
        await cache.delete(bibleKey);
    }
    const cached = await cache.get(bibleKey);
    if (cached !== null) {
        return cached;
    }
    const info = await bibleDataReader.readBibleData(bibleKey, '_info');
    if (info === null || checkIsBooksAvailableMissing(info)) {
        await cache.delete(bibleKey);
        showProgressBar(bibleKey);
        const isBibleXML = await checkIsBibleXML(bibleKey);
        hideProgressBar(bibleKey);
        if (isBibleXML) {
            return await getBibleInfo(bibleKey, true);
        }
    } else {
        freezeObject(info);
        await cache.set(bibleKey, info);
    }
    return info;
}
