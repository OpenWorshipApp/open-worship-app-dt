import { getKJVChapterCount, toBibleFileName } from './serverBibleHelpers';
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
    return Object.fromEntries(
        Object.entries(bibleVKList).map(([k, v]) => {
            return [v, k];
        }),
    );
}
export async function bookToKey(bibleKey: string, book: string) {
    const bookVKList = await getBookVKList(bibleKey);
    if (bookVKList === null) {
        return null;
    }
    return bookVKList[book] ?? null;
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

const bibleInfoMap = new Map<
    string,
    { info: BibleInfoType; timestamp: number }
>();
export async function getBibleInfo(
    bibleKey: string,
    isForce = false,
): Promise<BibleInfoType | null> {
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
    if (info === null || checkIsBooksAvailableMissing(info)) {
        bibleInfoMap.delete(bibleKey);
        showProgressBar(bibleKey);
        const isBibleXML = await checkIsBibleXML(bibleKey);
        hideProgressBar(bibleKey);
        if (isBibleXML) {
            return await getBibleInfo(bibleKey, true);
        }
    } else {
        bibleInfoMap.set(bibleKey, { info, timestamp: Date.now() });
    }
    return info;
}
