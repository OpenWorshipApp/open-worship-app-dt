import { useState } from 'react';

import {
    checkIsBookAvailable,
    getBibleInfo,
    getChapterData,
} from './bibleInfoHelpers';
import { getOnlineBibleInfoList } from './bibleDownloadHelpers';
import { useAppEffectAsync } from '../debuggerHelpers';
import { toLocaleNumBible } from './bibleLogicHelpers2';
import { getBibleModelInfo } from './bibleModelHelpers';

export type BibleStatusType = [string, boolean, string];

export const toLocaleNumQuick = (n: number, numList: string[]) => {
    if (!numList) {
        return n;
    }
    return `${n}`
        .split('')
        .map((n1) => {
            return numList[Number.parseInt(n1)];
        })
        .join('');
};

export type ChapterMatchType = {
    chapter: number;
    chapterLocaleString: string;
    isIntro?: boolean;
};
export async function genChapterMatches(
    bibleKey: string,
    bookKey: string,
    guessingChapter: string | null,
) {
    const chapterCount = getModelChapterCount(bookKey);
    const chapterList = Array.from({ length: chapterCount }, (_, i) => {
        return i + 1;
    });
    const chapterLocaleStringList = await Promise.all(
        chapterList.map((chapter) => {
            return toLocaleNumBible(bibleKey, chapter);
        }),
    );
    const newList: ChapterMatchType[] = chapterLocaleStringList
        .filter((chapterLocaleString) => {
            return chapterLocaleString !== null;
        })
        .map((chapterLocaleString, i) => {
            return {
                chapter: chapterList[i],
                chapterLocaleString,
            };
        });
    const newFilteredList = newList.filter((chapterMatch) => {
        return chapterMatch.chapterLocaleString !== null;
    });
    if (guessingChapter === null) {
        return newFilteredList;
    }
    const filteredList = newFilteredList.filter((chapterMatch) => {
        const chapterStr = `${chapterMatch.chapter}`;
        return (
            chapterStr.includes(guessingChapter) ||
            guessingChapter.includes(chapterStr) ||
            chapterMatch.chapterLocaleString.includes(guessingChapter) ||
            guessingChapter.includes(chapterMatch.chapterLocaleString)
        );
    });
    filteredList.sort((chapterMatch) => {
        const chapterStr = `${chapterMatch.chapter}`;
        if (
            chapterMatch.chapterLocaleString === guessingChapter ||
            chapterStr === guessingChapter
        ) {
            return -1;
        }
        return 1;
    });
    return filteredList;
}
export function useChapterMatch(
    bibleKey: string,
    bookKey: string,
    guessingChapter: string | null,
) {
    const [matchedChapters, setMatchedChapters] = useState<
        ChapterMatchType[] | null
    >(null);
    useAppEffectAsync(
        async (methodContext) => {
            if (!(await checkIsBookAvailable(bibleKey, bookKey))) {
                return;
            }
            const chapterLocaleStringList = await genChapterMatches(
                bibleKey,
                bookKey,
                guessingChapter,
            );
            const chapterZeroData = await getChapterData(bibleKey, bookKey, 0);
            const isIntro =
                Object.values(chapterZeroData?.verses ?? {}).length > 0;
            chapterLocaleStringList.unshift({
                chapter: 0,
                chapterLocaleString: 'Introduction',
                isIntro,
            });
            methodContext.setMatchedChapters(chapterLocaleStringList);
        },
        [bookKey, guessingChapter],
        { setMatchedChapters },
    );
    return matchedChapters;
}

export type BookMatchDataType = {
    bibleKey: string;
    bookKey: string;
    book: string;
    modelBook: string;
    isAvailable: boolean;
};
function check(v1: string, v2: string, isStartsWith = false) {
    if (isStartsWith) {
        const v1Lower = v1.toLowerCase();
        const v2Lower = v2.toLowerCase();
        return (
            v1Lower.startsWith(v2Lower) ||
            v1Lower.replaceAll(/\s/g, '').startsWith(v2Lower)
        );
    }
    if (v1.toLowerCase().includes(v2.toLowerCase())) {
        return true;
    }
}
export async function genBookMatches(
    bibleKey: string,
    guessingBook: string = '',
): Promise<BookMatchDataType[] | null> {
    const bibleInfo = await getBibleInfo(bibleKey);
    if (bibleInfo === null) {
        return null;
    }
    const keyBookMap = bibleInfo.keyBookMap;
    const modelKeyBook = getModelKeyBookMap();
    const bookKeys = Object.entries(modelKeyBook).map(
        ([bookKey, book]): [string, string] => {
            if (keyBookMap[bookKey]) {
                return [bookKey, keyBookMap[bookKey]];
            }
            return [bookKey, book];
        },
    );
    const bestMatchIndices = bookKeys.map(([bookKey, book]) => {
        const modelValue = modelKeyBook[bookKey];
        if (
            check(book, guessingBook, true) ||
            check(guessingBook, book, true) ||
            check(modelValue, guessingBook, true)
        ) {
            return true;
        }
        return false;
    });
    let bestMatchKeys = bookKeys.filter((_, i) => {
        return bestMatchIndices[i];
    });
    bestMatchKeys = bestMatchKeys.concat(
        bookKeys.filter(([bookKey, book], i) => {
            if (bestMatchIndices[i]) {
                return false;
            }
            const modelValue = modelKeyBook[bookKey];
            if (
                check(modelValue, guessingBook) ||
                check(guessingBook, modelValue) ||
                check(modelValue, guessingBook) ||
                check(guessingBook, modelValue) ||
                check(book, guessingBook) ||
                check(guessingBook, book)
            ) {
                return true;
            }
            return false;
        }),
    );
    const booksAvailable = bibleInfo.booksAvailable;
    const mappedKeys = bestMatchKeys.map(([bookKey, book]) => {
        return {
            bibleKey,
            bookKey,
            book,
            modelBook: modelKeyBook[bookKey],
            isAvailable: booksAvailable.includes(bookKey),
        };
    });
    return mappedKeys;
}

export function getModelKeyBookMap() {
    const bibleModelInfo = getBibleModelInfo();
    return bibleModelInfo.keyBookMap;
}

async function getBibleInfoWithStatus(
    bibleKey: string,
): Promise<BibleStatusType> {
    const bibleInfo = await getBibleInfo(bibleKey);
    const isAvailable = bibleInfo !== null;
    return [bibleKey, isAvailable, `${isAvailable ? '' : '🚫'}${bibleKey}`];
}

export async function getBibleInfoWithStatusList() {
    const list: BibleStatusType[] = [];
    const bibleListOnline = await getOnlineBibleInfoList();
    if (bibleListOnline === null) {
        return list;
    }
    for (const bible of bibleListOnline) {
        list.push(await getBibleInfoWithStatus(bible.key));
    }
    return list;
}

async function toChapter(
    bibleKey: string,
    bookKey: string,
    chapterNum: number,
) {
    // KJV, GEN, 1
    const bibleInfo = await getBibleInfo(bibleKey);
    if (bibleInfo === null) {
        return null;
    }
    const book = bibleInfo.keyBookMap[bookKey];
    return `${book} ${
        bibleInfo.numList === undefined
            ? chapterNum
            : toLocaleNumQuick(chapterNum, bibleInfo.numList)
    }`;
}

export function getModelChapterCount(bookKey: string) {
    // KJV, GEN
    const bibleModelInfo = getBibleModelInfo();
    return bibleModelInfo.books[bookKey].chapterCount;
}

export function toChapterList(bibleKey: string, bookKey: string) {
    // KJV, GEN
    const chapterCount = getModelChapterCount(bookKey);
    return Array.from({ length: chapterCount }, (_, i) => {
        return toChapter(bibleKey, bookKey, i + 1);
    });
}

function toIndex(bookKey: string, chapterNum: number) {
    let index = -1;
    let bookIndex = 0;
    if (chapterNum === 0) {
        chapterNum = 1;
    }
    const bibleModelInfo = getBibleModelInfo();
    while (bibleModelInfo.bookKeysOrder[bookIndex]) {
        const bookKey1 = bibleModelInfo.bookKeysOrder[bookIndex];
        const chapterCount = bibleModelInfo.books[bookKey1].chapterCount;
        if (bookKey1 === bookKey) {
            if (chapterNum > chapterCount) {
                return -1;
            }
            index += chapterNum;
            break;
        }
        index += chapterCount;
        bookIndex++;
    }
    return index;
}

export function toBibleFileName(bookKey: string, chapterNum: number) {
    // GEN, 1 => 0001-GEN.1
    const index = toIndex(bookKey, chapterNum);
    if (index < 0) {
        throw new Error('Invalid chapter number');
    }
    let indexStr = `000${index}`;
    indexStr = indexStr.substring(indexStr.length - 4);
    return `${indexStr}-${bookKey}.${chapterNum}`;
}

export function fromBibleFileName(fileName: string) {
    // 0001-GEN.1 => { bookKey: 'GEN', chapterNum: 1 }
    const regex = /^(\d+)-([1-3A-Z]+)\.(\d+)$/;
    const match = regex.exec(fileName);
    if (!match) {
        return null;
    }
    const bookKey = match[2];
    const chapterNum = Number.parseInt(match[3], 10);
    if (Number.isNaN(chapterNum)) {
        return null;
    }
    return { bookKey, chapterNum };
}
