import { useState } from 'react';

import { checkIsBookAvailable, getBibleInfo } from './bibleInfoHelpers';
import bibleJson from './bible.json';
import { getOnlineBibleInfoList } from './bibleDownloadHelpers';
import { useAppEffectAsync } from '../debuggerHelpers';
import { toLocaleNumBible } from './serverBibleHelpers2';
import { freezeObject } from '../helpers';

freezeObject(bibleJson);

export const bibleObj = bibleJson as {
    booksOrder: string[];
    books: { [key: string]: BookType };
    kjvKeyValue: { [key: string]: string };
};

export type BibleStatusType = [string, boolean, string];

export type BookType = {
    key: string;
    chapterCount: number;
};

export const toLocaleNumQuick = (n: number, numList: string[]) => {
    if (!numList) {
        return n;
    }
    return `${n}`
        .split('')
        .map((n1) => {
            return numList[parseInt(n1)];
        })
        .join('');
};

export async function genChapterMatches(
    bibleKey: string,
    bookKey: string,
    guessingChapter: string | null,
) {
    const chapterCount = getKJVChapterCount(bookKey);
    const chapterList = Array.from({ length: chapterCount }, (_, i) => {
        return i + 1;
    });
    const chapterNumStrList = await Promise.all(
        chapterList.map((chapter) => {
            return toLocaleNumBible(bibleKey, chapter);
        }),
    );
    const newList = chapterNumStrList.map((chapterNumStr, i) => {
        return [chapterList[i], chapterNumStr, bibleKey];
    });
    const newFilteredList = newList.filter((chapterMatch) => {
        return chapterMatch[0] !== null;
    }) as [number, string, string][];
    if (guessingChapter === null) {
        return newFilteredList;
    }
    const filteredList = newFilteredList.filter(([chapter, chapterNumStr]) => {
        const chapterStr = `${chapter}`;
        return (
            chapterStr.includes(guessingChapter) ||
            guessingChapter.includes(chapterStr) ||
            chapterNumStr.includes(guessingChapter) ||
            guessingChapter.includes(chapterNumStr)
        );
    });
    filteredList.sort(([chapter, chapterNumStr]) => {
        const chapterStr = `${chapter}`;
        if (
            chapterNumStr === guessingChapter ||
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
    const [matches, setMatches] = useState<[number, string, string][] | null>(
        null,
    );
    useAppEffectAsync(
        async (methodContext) => {
            if (!(await checkIsBookAvailable(bibleKey, bookKey))) {
                return;
            }
            const chapterNumStrList = await genChapterMatches(
                bibleKey,
                bookKey,
                guessingChapter,
            );
            methodContext.setMatches(chapterNumStrList);
        },
        [bookKey, guessingChapter],
        { setMatches },
    );
    return matches;
}

type BookMatchDataType = {
    bibleKey: string;
    bookKey: string;
    book: string;
    bookKJV: string;
    isAvailable: boolean;
};
export async function genBookMatches(
    bibleKey: string,
    guessingBook: string,
): Promise<BookMatchDataType[] | null> {
    const info = await getBibleInfo(bibleKey);
    if (info === null) {
        return null;
    }
    const bookKVList = info.books;
    const booksAvailable = info.booksAvailable;
    if (bookKVList === null) {
        return null;
    }
    const check = (v1: string, v2: string, isStartsWith = false) => {
        if (isStartsWith) {
            const v1Lower = v1.toLowerCase();
            const v2Lower = v2.toLowerCase();
            return (
                v1Lower.startsWith(v2Lower) ||
                v1Lower.replace(/ /g, '').startsWith(v2Lower)
            );
        }
        if (v1.toLowerCase().includes(v2.toLowerCase())) {
            return true;
        }
    };
    const keys = Object.entries(bookKVList);
    const kjvKeyValue = getKJVKeyValue();
    const bestMatchIndices = keys.map(([bookKey, book]) => {
        const kjvValue = kjvKeyValue[bookKey];
        if (
            check(book, guessingBook, true) ||
            check(guessingBook, book, true) ||
            check(kjvValue, guessingBook, true)
        ) {
            return true;
        }
        return false;
    });
    const bestMatchKeys = keys.filter((_, i) => {
        return bestMatchIndices[i];
    });
    const mappedKeys = bestMatchKeys
        .concat(
            keys.filter(([bookKey, book], i) => {
                if (bestMatchIndices[i]) {
                    return false;
                }
                const kjvValue = kjvKeyValue[bookKey];
                if (
                    check(kjvValue, guessingBook) ||
                    check(guessingBook, kjvValue) ||
                    check(kjvValue, guessingBook) ||
                    check(guessingBook, kjvValue) ||
                    check(book, guessingBook) ||
                    check(guessingBook, book)
                ) {
                    return true;
                }
                return false;
            }),
        )
        .map(([bookKey, book]) => {
            return {
                bibleKey,
                bookKey,
                book,
                bookKJV: kjvKeyValue[bookKey],
                isAvailable: booksAvailable.includes(bookKey),
            };
        });
    return mappedKeys;
}

export function getKJVKeyValue() {
    return bibleObj.kjvKeyValue;
}

async function getBibleInfoWithStatus(
    bibleKey: string,
): Promise<BibleStatusType> {
    const bibleInfo = await getBibleInfo(bibleKey);
    const isAvailable = bibleInfo !== null;
    return [bibleKey, isAvailable, `${!isAvailable ? '🚫' : ''}${bibleKey}`];
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
    const info = await getBibleInfo(bibleKey);
    if (info === null) {
        return null;
    }
    const book = info.books[bookKey];
    return `${book} ${
        info.numList === undefined
            ? chapterNum
            : toLocaleNumQuick(chapterNum, info.numList)
    }`;
}

export function getKJVChapterCount(bookKey: string) {
    // KJV, GEN
    return bibleObj.books[bookKey].chapterCount;
}

export function toChapterList(bibleKey: string, bookKey: string) {
    // KJV, GEN
    const chapterCount = getKJVChapterCount(bookKey);
    return Array.from({ length: chapterCount }, (_, i) => {
        return toChapter(bibleKey, bookKey, i + 1);
    });
}

function toIndex(bookKey: string, chapterNum: number) {
    let index = -1;
    let bIndex = 0;
    while (bibleObj.booksOrder[bIndex]) {
        const bookKey1 = bibleObj.booksOrder[bIndex];
        const chapterCount = bibleObj.books[bookKey1].chapterCount;
        if (bookKey1 === bookKey) {
            if (chapterNum > chapterCount) {
                return -1;
            }
            index += chapterNum;
            break;
        }
        index += chapterCount;
        bIndex++;
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
    const match = fileName.match(regex);
    if (!match) {
        return null;
    }
    const bookKey = match[2];
    const chapterNum = parseInt(match[3], 10);
    if (isNaN(chapterNum)) {
        return null;
    }
    return { bookKey, chapterNum };
}
