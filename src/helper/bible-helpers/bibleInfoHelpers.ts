import { getModelChapterCount, toBibleFileName } from './bibleLogicHelpers1';
import { bibleKeyToXMLFilePath } from '../../setting/bible-setting/bibleXMLJsonDataHelpers';
import type { BibleInfoType, BibleChapterType } from './BibleDataReader';
import { bibleDataReader } from './BibleDataReader';
import { fsCheckFileExist } from '../../server/fileHelpers';
import CacheManager from '../../others/CacheManager';
import { freezeObject } from '../helpers';
import { checkIsRtl } from '../../lang/langHelpers';
import { getVersesCount } from './bibleLogicHelpers2';
import type { BibleTargetType } from '../../bible-list/bibleRenderHelpers';
import { getBibleModelInfo } from './bibleModelHelpers';

export async function checkIsBookAvailable(bibleKey: string, bookKey: string) {
    const bibleInfo = await getBibleInfo(bibleKey);
    if (bibleInfo === null) {
        return false;
    }
    return bibleInfo.booksAvailable.includes(bookKey);
}

export async function getBookKVList(bibleKey: string) {
    const bibleInfo = await getBibleInfo(bibleKey);
    if (bibleInfo === null) {
        return null;
    }
    return bibleInfo.keyBookMap;
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
    const chapterCount = getModelChapterCount(bookKey);
    return chapterCount;
}
export async function getChapterData(
    bibleKey: string,
    bookKey: string,
    chapter: number,
) {
    const chapterCount = getModelChapterCount(bookKey);
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

export function checkIsOldTestament(bookKey: string) {
    const bibleModelInfo = getBibleModelInfo();
    return bibleModelInfo.bookKeysOld.includes(bookKey);
}

export function checkIsApocrypha(bookKey: string) {
    const { apocryphalBooks } = getBibleModelInfo();
    if (apocryphalBooks === undefined) {
        return false;
    }
    return apocryphalBooks.includes(bookKey);
}

const bibleInfoCache = new CacheManager<BibleInfoType>(60); // cache for 1 minutes
// TODO: cache newLines and newLinesTitleMap instead of attaching to bibleInfo
export async function getBibleInfo(
    bibleKey: string,
    isForce = false,
): Promise<BibleInfoType | null> {
    if (isForce) {
        await bibleInfoCache.delete(bibleKey);
    }
    const cached = await bibleInfoCache.get(bibleKey);
    if (cached !== null) {
        return cached;
    }
    const bibleInfo = await bibleDataReader.readBibleData(bibleKey, '_info');
    if (bibleInfo === null) {
        return null;
    } else {
        freezeObject(bibleInfo);
        await bibleInfoCache.set(bibleKey, bibleInfo);
    }
    return bibleInfo;
}

export async function getBibleInfoIsRtl(bibleKey: string) {
    const bibleInfo = await getBibleInfo(bibleKey);
    if (bibleInfo === null) {
        return false;
    }
    const isRtl = checkIsRtl(bibleInfo.locale);
    return isRtl;
}

export function toChapterFullKeyFormat(
    bookKey: string,
    chapter: string | number,
) {
    return `${bookKey} ${chapter}`;
}

export function toVerseFullKeyFormat(
    bookKey: string,
    chapter: string | number,
    verseStart: string | number,
    verseEnd?: string | number,
) {
    verseEnd ??= verseStart;
    verseEnd = verseEnd === verseStart ? '' : '-' + verseEnd;
    return `${toChapterFullKeyFormat(bookKey, chapter)}:${verseStart}${verseEnd}`;
}

const regex = /^([A-Z]{3}) (\d+):(\d+)(-(\d+))?$/;
export async function fromVerseKey(
    bibleKey: string,
    // JHN 18:33-
    verseKey: string,
): Promise<BibleTargetType | null> {
    const isLastDash = verseKey.endsWith('-');
    if (isLastDash) {
        verseKey = verseKey.slice(0, -1);
    }
    const match = regex.exec(verseKey);
    if (!match) {
        return null;
    }
    const bookKey = match[1];
    const chapter = Number.parseInt(match[2], 10);
    const verseStart = Number.parseInt(match[3], 10);
    let verseEnd = verseStart;
    if (match[5] !== undefined) {
        verseEnd = Number.parseInt(match[5], 10);
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
    };
}
