import { useState, useCallback } from 'react';

import {
    bookToKey,
    getBibleInfo,
    getChapterData,
    getVerses,
    toVerseKey,
} from './bibleInfoHelpers';
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
import {
    getKJVChapterCount,
    kjvBibleInfo,
    kjvNewLinerInfo,
} from './serverBibleHelpers';
import CacheManager from '../../others/CacheManager';
import {
    BibleMinimalInfoType,
    getAllLocalBibleInfoList,
} from './bibleDownloadHelpers';
import { unlocking } from '../../server/unlockingHelpers';
import { getSetting, setSetting } from '../settingHelpers';
import {
    ContentTitleType,
    CustomTitlesVerseType,
    CustomVerseContentType,
} from './BibleDataReader';

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
        if (kjvBibleInfo.oneChapterBooks.includes(bookKey ?? '')) {
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
    const info = await getBibleInfo(bibleKey);
    let localeNum: string | null = null;
    if (info?.numList !== undefined) {
        localeNum = toStringNum(info.numList, n);
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
    const info = await getBibleInfo(bibleKey);
    let num: number | null = null;
    if (info?.numList !== undefined) {
        num = fromStringNum(info.numList, localeNum);
    }
    if (num === null) {
        const locale = await getBibleLocale(bibleKey);
        num = await fromLocaleNum(locale, localeNum);
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
        String.raw`(^.+)$`,
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
export async function extractBibleTitle1(
    bibleKey: string,
    inputText: string,
    cleanText: string,
    time: number,
): Promise<EditingResultType> {
    for (const [regexStr, matcher] of regexTitleMap) {
        const regex = new RegExp(regexStr);
        const matches = regex.exec(cleanText);
        if (matches === null) {
            continue;
        }
        const result = await matcher(bibleKey, matches);
        if (result !== null) {
            return {
                result,
                bibleKey,
                inputText,
                oldInputText: inputText,
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
        oldInputText: inputText,
        time,
    };
}
const extractBibleTitleCache = new CacheManager<EditingResultType>(4); // 4 seconds
export async function extractBibleTitle(
    bibleKey: string,
    inputText: string,
    time = Date.now(),
): Promise<EditingResultType> {
    const cacheKey = `${bibleKey}:${inputText}`;
    return unlocking(cacheKey, async () => {
        const setCache = (data: EditingResultType) => {
            extractBibleTitleCache.set(cacheKey, data);
            return data;
        };
        const cleanText = inputText.trim().replaceAll(/\s+/g, ' ');
        if (cleanText === '') {
            const data = {
                result: genExtractedBible(),
                bibleKey,
                inputText: '',
                oldInputText: inputText,
                time,
            };
            return setCache(data);
        }
        const extractedData = await extractBibleTitle1(
            bibleKey,
            inputText,
            cleanText,
            time,
        );
        if (extractedData !== null) {
            return setCache(extractedData);
        }
        const extractedBibleKeyResult = await attemptExtractBibleKey(inputText);
        if (extractedBibleKeyResult !== null) {
            const data = await extractBibleTitle(
                extractedBibleKeyResult.bibleKey,
                extractedBibleKeyResult.inputText,
                time,
            );
            return setCache(data);
        }
        const result = genExtractedBible();
        result.guessingBook = cleanText;
        const data = {
            result,
            bibleKey,
            inputText: '',
            oldInputText: inputText,
            time,
        };
        return setCache(data);
    });
}

const SHOULD_KJV_NEW_LINE_SETTING_NAME = 'view-should-kjv-new-line';
export function getShouldKJVNewLine() {
    return getSetting(SHOULD_KJV_NEW_LINE_SETTING_NAME) !== 'false';
}
export function setShouldKJVNewLine(useKJVNewLine: boolean) {
    setSetting(
        SHOULD_KJV_NEW_LINE_SETTING_NAME,
        useKJVNewLine ? 'true' : 'false',
    );
}

export async function checkShouldNewLineKJV(
    bibleKey: string,
    bookKey: string,
    chapter: number,
    verse: number,
) {
    if (!getShouldKJVNewLine()) {
        return false;
    }
    const chapterData = await getChapterData(bibleKey, bookKey, chapter);
    if (chapterData?.newLines?.length) {
        return false;
    }
    const verseKey = toVerseKey(bookKey, chapter, verse);
    return kjvNewLinerInfo.includes(verseKey);
}

export async function checkShouldNewLine(
    bibleKey: string,
    bookKey: string,
    chapter: number,
    verse: number,
) {
    const chapterData = await getChapterData(bibleKey, bookKey, chapter);
    const verseKey = toVerseKey(bookKey, chapter, verse);
    if (chapterData?.newLines?.length) {
        return chapterData.newLines.includes(verseKey);
    }
    return false;
}

const defaultCssStyle =
    'width: 100%; display: inline-block; padding: 0.2em 0.4em; font-weight: bold; ';
export function genNewLineTitlesHtmlText(
    bibleKey: string,
    titles: ContentTitleType[],
) {
    return titles
        .map((title) => {
            return `
                    <div data-bible-key="${bibleKey}"
                    style="${defaultCssStyle} ${title.cssStyle ?? ''}">
                    ${title.content}
                    </div>
                    `;
        })
        .join('');
}
export async function getNewLineTitlesHtmlText(
    bibleKey: string,
    bookKey: string,
    chapter: number,
    verse: number,
) {
    const chapterData = await getChapterData(bibleKey, bookKey, chapter);
    if (!chapterData?.newLinesTitleMap) {
        return null;
    }
    const verseKey = toVerseKey(bookKey, chapter, verse);
    const titles = chapterData.newLinesTitleMap[verseKey] ?? [];
    if (titles.length === 0) {
        return null;
    }
    return genNewLineTitlesHtmlText(bibleKey, titles);
}

export async function getCustomVerseText(
    bibleKey: string,
    bookKey: string,
    chapter: number,
    verse: number,
) {
    const chapterData = await getChapterData(bibleKey, bookKey, chapter);
    if (!chapterData?.customVersesMap) {
        return null;
    }
    const verseKey = toVerseKey(bookKey, chapter, verse);
    const customVerseList = chapterData.customVersesMap[verseKey] ?? [];
    const renderList = customVerseList.map((item) => {
        if ((item as any).isTitle) {
            const itemTitle = item as CustomTitlesVerseType;
            return `
            <div class="mt-2">
                ${genNewLineTitlesHtmlText(bibleKey, itemTitle.titles)}
            </div>
            `;
        }
        if (!(item as any).content) {
            return '';
        }
        const itemVerse = item as CustomVerseContentType;
        if (itemVerse.isGW) {
            return `<span class="app-god-word">${itemVerse.content}</span>`;
        }
        return itemVerse.content;
    });
    const text = renderList
        .join('')
        .replaceAll('\n', '')
        .replaceAll(/\s+/g, ' ');
    if (text.trim() === '') {
        return null;
    }
    return text;
}
