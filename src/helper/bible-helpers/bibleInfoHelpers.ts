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
import { checkIsRtl } from '../../lang/langHelpers';
import { BibleTargetType } from '../../bible-list/bibleRenderHelpers';
import { getVersesCount } from './serverBibleHelpers2';

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
export async function getChapterData(
    bibleKey: string,
    bookKey: string,
    chapter: number,
) {
    const chapterCount = getKJVChapterCount(bookKey);
    if (chapterCount === null || chapter > chapterCount) {
        return null;
    }
    const fileName = toBibleFileName(bookKey, chapter);
    const chapterData = (await bibleDataReader.readBibleData(
        bibleKey,
        fileName,
    )) as BibleChapterType | null;
    if (chapterData === null) {
        return null;
    }
    return chapterData;
}
export async function getVerses(
    bibleKey: string,
    bookKey: string,
    chapter: number,
) {
    const chapterData = await getChapterData(bibleKey, bookKey, chapter);
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
// TODO: cache newLines and newLinesTitleMap instead of attaching to bibleInfo
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

export async function getBibleInfoIsRtl(bibleKey: string) {
    const bibleInfo = await getBibleInfo(bibleKey);
    if (bibleInfo === null) {
        return false;
    }
    const isRtl = checkIsRtl(bibleInfo.locale);
    return isRtl;
}

const regex = /^([A-Z]{3}) (\d+):(\d+)(-(\d+))?$/;
export async function fromVerseKey(
    bibleKey: string,
    // JHN 18:33-
    verseKey: string,
) {
    const isLastDash = verseKey.endsWith('-');
    if (isLastDash) {
        verseKey = verseKey.slice(0, -1);
    }
    const match = verseKey.match(regex);
    if (!match) {
        return null;
    }
    const bookKey = match[1];
    const chapter = parseInt(match[2], 10);
    const verseStart = parseInt(match[3], 10);
    let verseEnd = verseStart;
    if (match[5] !== undefined) {
        verseEnd = parseInt(match[5], 10);
    }
    if (isLastDash) {
        const verseCount = await getVersesCount(bibleKey, bookKey, chapter);
        if (verseCount === null) {
            return null;
        }
        verseEnd = verseCount;
    }
    return {
        bookKey,
        chapter,
        verseStart,
        verseEnd,
    } as BibleTargetType;
}

export function toVerseKey(
    bookKey: string,
    chapter: string | number,
    verseStart: string | number,
    verseEnd?: string | number,
) {
    verseEnd ??= verseStart;
    verseEnd = verseEnd === verseStart ? '' : '-' + verseEnd;
    return `${bookKey} ${chapter}:${verseStart}${verseEnd}`;
}
