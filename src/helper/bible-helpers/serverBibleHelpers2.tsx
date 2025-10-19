import { useState } from 'react';

import { bookToKey, getBibleInfo, getVerses } from './bibleInfoHelpers';
import {
    fromLocaleNum,
    fromStringNum,
    getFontFamilyByLocale,
    getLangAsync,
    LocaleType,
    toLocaleNum,
    toStringNum,
} from '../../lang/langHelpers';
import { useAppEffect } from '../debuggerHelpers';
import BibleItem from '../../bible-list/BibleItem';
import { getKJVChapterCount } from './serverBibleHelpers';
import CacheManager from '../../others/CacheManager';
import { getAllLocalBibleInfoList } from './bibleDownloadHelpers';
import { unlocking } from '../../server/unlockingHelpers';

export async function toInputText(
    bibleKey: string,
    book?: string | null,
    chapter?: number | null,
    verseStart?: number | null,
    verseEnd?: number | null,
) {
    let txt = '';
    if (book) {
        txt += `${book} `;
        if (chapter !== undefined && chapter !== null) {
            txt += `${await toLocaleNumBible(bibleKey, chapter)}`;
            if (verseStart !== undefined && verseStart !== null) {
                txt += `:${await toLocaleNumBible(bibleKey, verseStart)}`;
                if (
                    verseEnd !== undefined &&
                    verseEnd !== null &&
                    verseEnd !== verseStart
                ) {
                    txt += `-${await toLocaleNumBible(bibleKey, verseEnd)}`;
                }
            }
        }
    }
    // 1 John 1:1-2
    return txt;
}

export async function getBibleLocale(bibleKey: string) {
    const info = await getBibleInfo(bibleKey);
    if (info === null) {
        return 'en' as LocaleType;
    }
    return info.locale;
}

export async function getLangFromBibleKey(bibleKey: string) {
    const locale = await getBibleLocale(bibleKey);
    const langData =
        (await getLangAsync(locale)) || (await getLangAsync('en-US'));
    return langData;
}

export async function getBibleFontFamily(bibleKey: string) {
    const locale = await getBibleLocale(bibleKey);
    const fontFamily = await getFontFamilyByLocale(locale);
    return fontFamily;
}

// TODO: use LRUCache instead
const bibleLocaleNumMap = new Map<string, string | null>();
export async function toLocaleNumBible(bibleKey: string, n: number | null) {
    const cacheKey = `${bibleKey}:${n}`;
    if (bibleLocaleNumMap.has(cacheKey)) {
        return bibleLocaleNumMap.get(cacheKey) as string | null;
    }
    if (typeof n !== 'number') {
        return null;
    }
    const info = await getBibleInfo(bibleKey);
    let localeNum: string | null = null;
    if (info?.numList !== undefined) {
        localeNum = toStringNum(info.numList, n);
    }
    if (localeNum === null) {
        const locale = await getBibleLocale(bibleKey);
        localeNum = await toLocaleNum(locale, n);
    }
    bibleLocaleNumMap.set(cacheKey, localeNum);
    return localeNum;
}

export function useToLocaleNumBible(bibleKey: string, nString: number | null) {
    const [str, setStr] = useState<string | null>(null);
    useAppEffect(() => {
        toLocaleNumBible(bibleKey, nString).then(setStr);
    }, [bibleKey, nString]);
    return str;
}

// TODO: use LRUCache instead
const bibleNumMap = new Map<string, number | null>();
export async function fromLocaleNumBible(bibleKey: string, localeNum: string) {
    const cacheKey = `${bibleKey}:${localeNum}`;
    if (bibleNumMap.has(cacheKey)) {
        return bibleNumMap.get(cacheKey) as number | null;
    }
    const info = await getBibleInfo(bibleKey);
    let num: number | null = null;
    if (info !== null && info.numList !== undefined) {
        num = fromStringNum(info.numList, localeNum);
    }
    if (num === null) {
        const locale = await getBibleLocale(bibleKey);
        num = await fromLocaleNum(locale, localeNum);
    }
    bibleNumMap.set(cacheKey, num);
    return num;
}

export function useFromLocaleNumBible(bibleKey: string, localeNum: string) {
    const [newLocaleNum, setNewLocaleNum] = useState<number | null>(null);
    useAppEffect(() => {
        fromLocaleNumBible(bibleKey, localeNum).then(setNewLocaleNum);
    }, [bibleKey, localeNum]);
    return newLocaleNum;
}

export type ExtractedBibleResult = {
    bookKey: string | null;
    guessingBook: string | null;
    chapter: number | null;
    guessingChapter: string | null;
    bibleItem: BibleItem | null;
};

export function genExtractedBible(): ExtractedBibleResult {
    return {
        bookKey: null,
        guessingBook: null,
        chapter: null,
        guessingChapter: null,
        bibleItem: null,
    };
}

export async function parseChapterFromGuessing(
    bibleKey: string,
    bookKey: string,
    chapter: string,
) {
    const chapterNum = await fromLocaleNumBible(bibleKey, chapter);
    const chapterCount = getKJVChapterCount(bookKey);
    if (chapterNum === null || chapterNum < 1 || chapterNum > chapterCount) {
        return null;
    }
    return chapterNum;
}

const verseCountCacher = new CacheManager<number>(60); // 1 minute
export async function getVersesCount(
    bibleKey: string,
    bookKey: string,
    chapterNum: number,
) {
    const key = `${bibleKey}:${bookKey}:${chapterNum}`;
    return await unlocking(key, async () => {
        let verseCount = await verseCountCacher.get(key);
        if (verseCount !== null) {
            return verseCount;
        }
        const verses = await getVerses(bibleKey, bookKey, chapterNum);
        if (verses === null) {
            return null;
        }
        verseCount = Object.keys(verses).length;
        await verseCountCacher.set(key, verseCount);
        return verseCount;
    });
}

async function transformExtracted(
    bibleKey: string,
    book: string,
    chapter: string | null,
    verseStart: string | null,
    verseEnd: string | null,
): Promise<ExtractedBibleResult | null> {
    const result = genExtractedBible();
    result.guessingBook = book;
    result.guessingChapter = chapter;
    if (book === null) {
        return result;
    }
    const bookKey = await bookToKey(bibleKey, book);
    if (bookKey === null) {
        return null;
    }
    result.bookKey = bookKey;
    result.guessingBook = null;
    if (chapter === null) {
        return result;
    }
    if (chapter.endsWith(':')) {
        chapter = chapter.replace(':', '');
        result.guessingChapter = chapter;
    } else if (verseStart === null && verseEnd === null) {
        return result;
    }
    const chapterNum = await parseChapterFromGuessing(
        bibleKey,
        bookKey,
        chapter,
    );
    if (chapterNum === null) {
        return result;
    }
    const verseCount = await getVersesCount(bibleKey, bookKey, chapterNum);
    if (verseCount === null) {
        return result;
    }
    result.chapter = chapterNum;
    result.guessingChapter = null;
    result.bibleItem = BibleItem.fromData(
        bibleKey,
        bookKey,
        chapterNum,
        1,
        verseCount,
    );
    const target = result.bibleItem.target;
    if (verseStart !== null) {
        const verseStartNum = await fromLocaleNumBible(bibleKey, verseStart);
        if (verseStartNum !== null) {
            target.verseStart =
                verseStartNum > 0 && verseStartNum <= verseCount
                    ? verseStartNum
                    : 1;
        }
    }
    if (verseEnd !== null) {
        const verseEndNum = await fromLocaleNumBible(bibleKey, verseEnd);
        if (verseEndNum !== null) {
            target.verseEnd =
                verseEndNum > 0 && verseEndNum <= verseCount
                    ? verseEndNum
                    : verseCount;
        }
    }
    const { verseStart: newVerseStart, verseEnd: newVerseEnd } = target;
    if (
        newVerseEnd < 1 ||
        newVerseEnd < newVerseStart ||
        newVerseStart > verseCount
    ) {
        target.verseStart = 1;
        target.verseEnd = verseCount;
    }
    return result;
}

const regexTitleMap: [
    string,
    (
        bibleKey: string,
        matches: RegExpMatchArray,
    ) => Promise<ExtractedBibleResult | null>,
][] = [
    // "1 John 1:1-2"
    [
        '(^.+)\\s(.+):(.+)-(.+)$',
        async (bibleKey, matches) => {
            if (matches.length !== 5) {
                return null;
            }
            const [_, book, chapter, verseStart, verseEnd] = matches;
            return transformExtracted(
                bibleKey,
                book,
                chapter,
                verseStart,
                verseEnd,
            );
        },
    ],
    // "1 John 1:1-"
    [
        '(^.+)\\s(.+):(.+)-$',
        async (bibleKey, matches) => {
            if (matches.length !== 4) {
                return null;
            }
            const [_, book, chapter, verseStart] = matches;
            const verseEnd = null;
            return transformExtracted(
                bibleKey,
                book,
                chapter,
                verseStart,
                verseEnd,
            );
        },
    ],
    // "1 John 1:1"
    [
        '(^.+)\\s(.+):(.+)$',
        async (bibleKey, matches) => {
            if (matches.length !== 4) {
                return null;
            }
            const [_, book, chapter, verseStart] = matches;
            const verseEnd = verseStart;
            return transformExtracted(
                bibleKey,
                book,
                chapter,
                verseStart,
                verseEnd,
            );
        },
    ],
    // "1 John 1:"
    [
        '(^.+)\\s(.+)$',
        async (bibleKey, matches) => {
            if (matches.length !== 3) {
                return null;
            }
            const [_, book, chapter] = matches;
            const verseStart = null;
            const verseEnd = null;
            return transformExtracted(
                bibleKey,
                book,
                chapter,
                verseStart,
                verseEnd,
            );
        },
    ],
    // "1 John"
    [
        '(^.+)$',
        async (bibleKey, matches) => {
            if (matches.length !== 2) {
                return null;
            }
            const [_, book] = matches;
            const chapter = null;
            const verseStart = null;
            const verseEnd = null;
            return transformExtracted(
                bibleKey,
                book,
                chapter,
                verseStart,
                verseEnd,
            );
        },
    ],
];

async function checkExtractedAndReturn(bibleKey: string, inputText: string) {
    const allLocalBibleInfoList = await getAllLocalBibleInfoList();
    if (allLocalBibleInfoList.some((info) => info.key === bibleKey)) {
        return {
            bibleKey,
            inputText,
        };
    }
    return null;
}
async function attemptExtractBibleKey(inputText: string) {
    if (inputText.startsWith('(')) {
        const allLocalBibleInfoList = await getAllLocalBibleInfoList();
        // (kjv) 1 John 1:1-2
        const regex = /^\((.+)\)\s(.+)$/;
        const matches = regex.exec(inputText);
        if (matches !== null && matches.length === 3) {
            const bibleKey = matches[1].trim();
            if (allLocalBibleInfoList.some((info) => info.key === bibleKey)) {
                const inputText1 = matches[2].trim();
                return checkExtractedAndReturn(bibleKey, inputText1);
            }
        }
    }
    // 1 John 1:1-2 kjv
    const regex = /^(.+:.+)\s(.+)$/;
    const matches = regex.exec(inputText);
    if (matches !== null && matches.length === 3) {
        const bookChapter = matches[1].trim();
        const bibleKey = matches[2].trim();
        const allLocalBibleInfoList = await getAllLocalBibleInfoList();
        if (allLocalBibleInfoList.some((info) => info.key === bibleKey)) {
            return checkExtractedAndReturn(bibleKey, bookChapter);
        }
    }
    return null;
}

export type EditingResultType = {
    result: ExtractedBibleResult;
    bibleKey: string;
    inputText: string;
    oldInputText: string;
};
export async function extractBibleTitle(
    bibleKey: string,
    inputText: string,
): Promise<EditingResultType> {
    const cleanText = inputText.trim().replace(/\s+/g, ' ');
    const extractedBibleKeyResult = await attemptExtractBibleKey(inputText);
    if (extractedBibleKeyResult !== null) {
        return extractBibleTitle(
            extractedBibleKeyResult.bibleKey,
            extractedBibleKeyResult.inputText,
        );
    }
    if (cleanText === '') {
        return {
            result: genExtractedBible(),
            bibleKey,
            inputText: '',
            oldInputText: inputText,
        };
    }
    for (const [regexStr, matcher] of regexTitleMap) {
        const regex = new RegExp(regexStr);
        const matches = regex.exec(cleanText);
        if (matches === null) {
            continue;
        }
        const result = await matcher(bibleKey, matches);
        if (result !== null) {
            return { result, bibleKey, inputText, oldInputText: inputText };
        }
    }
    const result = genExtractedBible();
    result.guessingBook = cleanText;
    return { result, bibleKey, inputText: '', oldInputText: inputText };
}
