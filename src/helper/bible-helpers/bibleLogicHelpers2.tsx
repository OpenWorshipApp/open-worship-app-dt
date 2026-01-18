import { useState, useCallback } from 'react';

import {
    bookToKey,
    getBibleInfo,
    getChapterData,
    getVerses,
    keyToBook,
    toVerseFullKeyFormat,
} from './bibleInfoHelpers';
import {
    fromLocaleNum,
    fromStringNum,
    getFontFamilyByLocale,
    getLangDataAsync,
    LocaleType,
    toLocaleNum,
    toStringNum,
} from '../../lang/langHelpers';
import { useAppEffect } from '../debuggerHelpers';
import BibleItem from '../../bible-list/BibleItem';
import { getModelChapterCount } from './bibleLogicHelpers1';
import CacheManager from '../../others/CacheManager';
import {
    BibleMinimalInfoType,
    getAllLocalBibleInfoList,
} from './bibleDownloadHelpers';
import { unlocking } from '../../server/unlockingHelpers';
import { getSetting, setSetting } from '../settingHelpers';
import { log } from '../loggerHelpers';
import { getBibleModelInfo, modelNewLinerInfo } from './bibleModelHelpers';

export async function toInputText(
    bibleKey: string,
    book?: string | null,
    chapter?: number | null,
    verseStart?: number | null,
    verseEnd?: number | null,
) {
    let text = '';
    if (!book) {
        return text;
    }
    text += `${book} `;
    if (!chapter) {
        const bookKey = await bookToKey(bibleKey, book);
        const bibleModelInfo = getBibleModelInfo();
        if (bibleModelInfo.oneChapterBooks.includes(bookKey ?? '')) {
            text += `${await toLocaleNumBible(bibleKey, 1)}:`;
            return text;
        }
        // 1 John
        return text;
    }
    text += `${await toLocaleNumBible(bibleKey, chapter)}`;
    if (!verseStart) {
        // 1 John 1
        return text;
    }
    text += `:${await toLocaleNumBible(bibleKey, verseStart)}`;
    if (!verseEnd || verseEnd !== verseStart) {
        // 1 John 1:1
        return text;
    }
    text += `-${await toLocaleNumBible(bibleKey, verseEnd)}`;
    // 1 John 1:1-2
    return text;
}

export async function getBibleLocale(bibleKey: string) {
    const bibleInfo = await getBibleInfo(bibleKey);
    if (bibleInfo === null) {
        return 'en' as LocaleType;
    }
    return bibleInfo.locale;
}

export async function getLangDataFromBibleKey(bibleKey: string) {
    const locale = await getBibleLocale(bibleKey);
    const langData =
        (await getLangDataAsync(locale)) || (await getLangDataAsync('en-US'));
    return langData;
}

export async function getBibleFontFamily(bibleKey: string) {
    const locale = await getBibleLocale(bibleKey);
    const fontFamily = await getFontFamilyByLocale(locale);
    return fontFamily;
}

const toLocaleNumCache = new CacheManager<string>(60); // 1 minute
export async function toLocaleNumBible(bibleKey: string, n: number | null) {
    const cacheKey = `${bibleKey}:${n}`;
    const cached = await toLocaleNumCache.get(cacheKey);
    if (cached !== null) {
        return cached;
    }
    if (typeof n !== 'number') {
        return n;
    }
    const bibleInfo = await getBibleInfo(bibleKey);
    let localeNum: string | null = null;
    if (bibleInfo?.numList !== undefined) {
        localeNum = toStringNum(bibleInfo.numList, n);
    }
    if (localeNum === null) {
        const locale = await getBibleLocale(bibleKey);
        localeNum = await toLocaleNum(locale, n);
    }
    await toLocaleNumCache.set(cacheKey, localeNum);
    return localeNum;
}

export function useToLocaleNumBible(bibleKey: string, nString: number | null) {
    const [str, setStr] = useState<string | null>(null);
    const fetchLocaleNum = useCallback(() => {
        toLocaleNumBible(bibleKey, nString).then(setStr);
    }, [bibleKey, nString]);

    useAppEffect(fetchLocaleNum, [fetchLocaleNum]);
    return str;
}

const localeNumCache = new CacheManager<number | null>(60); // 1 minute
export async function fromLocaleNumBible(bibleKey: string, localeNum: string) {
    const cacheKey = `${bibleKey}:${localeNum}`;
    if (await localeNumCache.has(cacheKey)) {
        return localeNumCache.get(cacheKey);
    }
    const bibleInfo = await getBibleInfo(bibleKey);
    let num: number | null = null;
    if (bibleInfo?.numList !== undefined) {
        num = fromStringNum(bibleInfo.numList, localeNum);
    }
    if (num === null) {
        const locale = await getBibleLocale(bibleKey);
        num = await fromLocaleNum(locale, localeNum);
    }
    if (num === null) {
        try {
            const parsed = Number.parseInt(
                localeNum.replaceAll(/[^\d]/g, ''),
                10,
            );
            if (!Number.isNaN(parsed)) {
                num = parsed;
            }
        } catch (_error) {}
    }
    await localeNumCache.set(cacheKey, num);
    return num;
}

export function useFromLocaleNumBible(bibleKey: string, localeNum: string) {
    const [newLocaleNum, setNewLocaleNum] = useState<number | null>(null);
    const fetchFromLocaleNum = useCallback(() => {
        fromLocaleNumBible(bibleKey, localeNum).then(setNewLocaleNum);
    }, [bibleKey, localeNum]);

    useAppEffect(fetchFromLocaleNum, [fetchFromLocaleNum]);
    return newLocaleNum;
}

export type ExtractedBibleResult = {
    bookKey: string | null;
    guessingBook: string | null;
    chapter: number | null;
    guessingChapter: string | null;
    bibleItem: BibleItem | null;
    extraBibleItems?: BibleItem[];
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
    const chapterCount = getModelChapterCount(bookKey);
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
        String.raw`(^.+)\s(.+):(.+)-(.+)$`,
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
        String.raw`(^.+)\s(.+):(.+)-$`,
        async (bibleKey, matches) => {
            if (matches.length !== 4) {
                return null;
            }
            const [_, book, chapter, verseStart] = matches;
            return transformExtracted(
                bibleKey,
                book,
                chapter,
                verseStart,
                null,
            );
        },
    ],
    // "1 John 1:1"
    [
        String.raw`(^.+)\s(.+):(.+)$`,
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
        String.raw`(^.+)\s(.+)$`,
        async (bibleKey, matches) => {
            if (matches.length !== 3) {
                return null;
            }
            const [_, book, chapter] = matches;
            return transformExtracted(bibleKey, book, chapter, null, null);
        },
    ],
    // "1 John"
    [
        String.raw`(^.+)$`,
        async (bibleKey, matches) => {
            if (matches.length !== 2) {
                return null;
            }
            const [_, book] = matches;
            return transformExtracted(bibleKey, book, null, null, null);
        },
    ],
    // "2JN 10:1-2"
    [
        String.raw`^([123A-Z]{3})\s(\d+):(\d+)-(\d+)$`,
        async (bibleKey, matches) => {
            if (matches.length !== 5) {
                return null;
            }
            const [_, booKey, chapter, verseStart, verseEnd] = matches;
            const book = await keyToBook(bibleKey, booKey);
            if (book === null) {
                return null;
            }
            return transformExtracted(
                bibleKey,
                book,
                chapter,
                verseStart,
                verseEnd,
            );
        },
    ],
    // "2JN 10:1"
    [
        String.raw`^([123A-Z]{3})\s(\d+):(\d+)$`,
        async (bibleKey, matches) => {
            if (matches.length !== 4) {
                return null;
            }
            const [_, booKey, chapter, verseStart] = matches;
            const book = await keyToBook(bibleKey, booKey);
            if (book === null) {
                return null;
            }
            return transformExtracted(
                bibleKey,
                book,
                chapter,
                verseStart,
                null,
            );
        },
    ],
    // "2JN 10"
    [
        String.raw`^([123A-Z]{3})\s(\d+)$`,
        async (bibleKey, matches) => {
            if (matches.length !== 3) {
                return null;
            }
            const [_, booKey, chapter] = matches;
            const book = await keyToBook(bibleKey, booKey);
            if (book === null) {
                return null;
            }
            return transformExtracted(bibleKey, book, chapter, null, null);
        },
    ],
    // "2JN"
    [
        String.raw`^([123A-Z]{3})$`,
        async (bibleKey, matches) => {
            if (matches.length !== 2) {
                return null;
            }
            const [_, booKey] = matches;
            const book = await keyToBook(bibleKey, booKey);
            if (book === null) {
                return null;
            }
            return transformExtracted(bibleKey, book, null, null, null);
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

const attemptInputTextCache = new CacheManager<{
    bibleKey: string;
    inputText: string;
} | null>(60); // 1 minute
async function attemptExtractBibleKey1(
    inputText: string,
    allLocalBibleInfoList: BibleMinimalInfoType[],
    bibleKey: string,
    restText: string,
) {
    const foundBibleInfo = allLocalBibleInfoList.find((bibleInfo) => {
        return bibleInfo.key.toLowerCase() === bibleKey.trim().toLowerCase();
    });
    if (foundBibleInfo === undefined) {
        return null;
    }
    const result = await checkExtractedAndReturn(foundBibleInfo.key, restText);
    if (result !== null) {
        await attemptInputTextCache.set(inputText, result);
        return result;
    }
    return null;
}

async function attemptExtractBibleKey(inputText: string) {
    return unlocking(inputText, async () => {
        if (await attemptInputTextCache.has(inputText)) {
            return await attemptInputTextCache.get(inputText);
        }
        const text = inputText.trim().replaceAll(/\s+/g, ' ');
        if (!text) {
            return null;
        }
        const allLocalBibleInfoList = await getAllLocalBibleInfoList();
        // (kjv) 1 John 1:2-3
        let matches = /^\((\S+)\)\s(.+)$/.exec(text);
        if (matches?.length === 3) {
            const result = await attemptExtractBibleKey1(
                inputText,
                allLocalBibleInfoList,
                matches[1].trim(),
                matches[2].trim(),
            );
            if (result !== null) {
                return result;
            }
        }
        // nkjv 2 Timothy 2:3-4
        matches = /^(\S+)\s(.+)$/.exec(text);
        if (matches?.length === 3) {
            const result = await attemptExtractBibleKey1(
                inputText,
                allLocalBibleInfoList,
                matches[1].trim(),
                matches[2].trim(),
            );
            if (result !== null) {
                return result;
            }
        }
        // 3 John 1:4-5 (esv)
        matches = /^(.+)\s\((\S+)\)$/.exec(text);
        if (matches?.length === 3) {
            const result = await attemptExtractBibleKey1(
                inputText,
                allLocalBibleInfoList,
                matches[2].trim(),
                matches[1].trim(),
            );
            if (result !== null) {
                return result;
            }
        }
        // 1 Kings 4:5-6 niv
        matches = /^(.+)\s(\S+)$/.exec(text);
        if (matches?.length === 3) {
            const result = await attemptExtractBibleKey1(
                inputText,
                allLocalBibleInfoList,
                matches[2].trim(),
                matches[1].trim(),
            );
            if (result !== null) {
                return result;
            }
        }
        await attemptInputTextCache.set(inputText, null);
        return null;
    });
}

export type EditingResultType = {
    result: ExtractedBibleResult;
    bibleKey: string;
    inputText: string;
    oldInputText: string;
    time: number;
};
export async function extractBibleTitleByRegex(
    bibleKey: string,
    inputText: string,
    cleanText: string,
    time: number,
): Promise<EditingResultType> {
    const oldInputText = inputText;
    for (const [regexStr, parse] of regexTitleMap) {
        const regex = new RegExp(regexStr);
        const matches = regex.exec(cleanText);
        if (matches === null) {
            continue;
        }
        const result = await parse(bibleKey, matches);
        if (result !== null) {
            return {
                result,
                bibleKey,
                inputText,
                oldInputText,
                time,
            };
        }
    }
    const extractedBibleKeyResult = await attemptExtractBibleKey(inputText);
    if (extractedBibleKeyResult !== null) {
        return extractBibleTitle(
            extractedBibleKeyResult.bibleKey,
            extractedBibleKeyResult.inputText,
            time,
        );
    }
    const result = genExtractedBible();
    result.guessingBook = cleanText;
    return {
        result,
        bibleKey,
        inputText: '',
        oldInputText,
        time,
    };
}

// John 1:1-2: => John 1:1-, John 2:
const numRegexString = String.raw`[^\s-:]`;
const brokenRegex = new RegExp(
    String.raw`^(.+${numRegexString}+\s${numRegexString}+:${numRegexString}+-)` +
        String.raw`(${numRegexString}+:${numRegexString}*)$`,
);
function breakText(inputText: string) {
    let extra: string | null = null;
    const matches = brokenRegex.exec(inputText);
    if (matches !== null && matches.length === 3) {
        inputText = matches[1].trim();
        extra = matches[2].trim();
    }
    if (extra) {
        const arr = extra.split(':');
        extra = `${arr[0]}:1-${arr[1]}`;
    }
    return {
        inputText,
        extra,
    };
}
async function genExtraBibleItems(
    bibleItem: BibleItem,
    extraInputText: string,
): Promise<BibleItem[] | undefined> {
    const title = await bibleItem.toTitle();
    const arr = title.split(' ');
    arr.pop();
    const book = arr.join(' ');
    const extraVerseKey = `${book} ${extraInputText}`;
    const { bibleKey } = bibleItem;
    const endBibleItem = await BibleItem.fromTitleText(bibleKey, extraVerseKey);
    const startChapter = bibleItem.target.chapter;
    if (endBibleItem === null || endBibleItem.target.chapter <= startChapter) {
        return undefined;
    }
    const extraBibleItems: BibleItem[] = [];
    const chapterRange =
        endBibleItem.target.chapter - bibleItem.target.chapter - 1;
    for (let i = 1; i <= chapterRange; i++) {
        const chapterNum = startChapter + i;
        const newBibleItem = await BibleItem.fromTitleText(
            bibleKey,
            `${book} ${chapterNum}:`,
        );
        if (newBibleItem === null) {
            log(
                'Failed to generate extra bible item for',
                `${book} ${chapterNum}:`,
            );
            return undefined;
        }
        extraBibleItems.push(newBibleItem);
    }
    return [...extraBibleItems, endBibleItem];
}
const extractBibleTitleCache = new CacheManager<EditingResultType>(4); // 4 seconds
function setCache(cacheKey: string, data: EditingResultType) {
    extractBibleTitleCache.set(cacheKey, data);
    return data;
}
export async function extractBibleTitle(
    bibleKey: string,
    inputText: string,
    time = Date.now(),
): Promise<EditingResultType> {
    const cacheKey = `${bibleKey}:${inputText}`;
    return unlocking(cacheKey, async () => {
        const cachedData = await extractBibleTitleCache.get(cacheKey);
        if (cachedData !== null) {
            return cachedData;
        }
        // "   Matthew  5.1-2 " => "Matthew 5:1-2"
        let cleanText = inputText.trim().replaceAll(/\s+/g, ' ');
        // 1 John 1.1 => 1 John 1:1
        cleanText = cleanText.replaceAll(/(.+\s+.+)\.(.?)/g, '$1:$2');
        const brokenInputText = breakText(cleanText);
        cleanText = brokenInputText.inputText;
        const locale = await getBibleLocale(bibleKey);
        const lang = await getLangDataAsync(locale);
        if (lang !== null) {
            cleanText = lang.sanitizeText(cleanText);
        }
        if (cleanText === '') {
            const data = {
                result: genExtractedBible(),
                bibleKey,
                inputText: '',
                oldInputText: inputText,
                time,
            };
            return setCache(cacheKey, data);
        }
        const extractedData = await extractBibleTitleByRegex(
            bibleKey,
            inputText,
            cleanText,
            time,
        );
        const { bibleItem } = extractedData.result;
        if (bibleItem !== null && brokenInputText.extra !== null) {
            const extraBibleItems = await genExtraBibleItems(
                bibleItem,
                brokenInputText.extra,
            );
            extractedData.result.extraBibleItems = extraBibleItems;
        }
        return setCache(cacheKey, extractedData);
    });
}

const SHOULD_MODEL_NEW_LINE_SETTING_NAME = 'view-should-model-new-line';
export function getShouldModelNewLine() {
    return getSetting(SHOULD_MODEL_NEW_LINE_SETTING_NAME) !== 'false';
}
export function setShouldModelNewLine(shouldModelNewLine: boolean) {
    setSetting(
        SHOULD_MODEL_NEW_LINE_SETTING_NAME,
        shouldModelNewLine ? 'true' : 'false',
    );
}

export async function checkShouldNewLineModel(
    bibleKey: string,
    bookKey: string,
    chapter: number,
    verse: number,
) {
    if (!getShouldModelNewLine()) {
        return false;
    }
    const chapterData = await getChapterData(bibleKey, bookKey, chapter);
    if (chapterData?.newLines?.length) {
        return false;
    }
    const verseKey = toVerseFullKeyFormat(bookKey, chapter, verse);
    return modelNewLinerInfo.includes(verseKey);
}

export async function checkShouldNewLine(
    bibleKey: string,
    bookKey: string,
    chapter: number,
    verse: number,
) {
    const chapterData = await getChapterData(bibleKey, bookKey, chapter);
    const verseKey = toVerseFullKeyFormat(bookKey, chapter, verse);
    if (chapterData?.newLines?.length) {
        return chapterData.newLines.includes(verseKey);
    }
    return false;
}
