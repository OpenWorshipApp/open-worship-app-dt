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
    getLangDataAsync,
    toLocaleNum,
    toStringNum,
} from '../../lang/langHelpers';
import { useAppEffect } from '../appHooks';
import BibleItem from '../../bible-list/BibleItem';
import { getModelChapterCount, getModelKeyBookMap } from './bibleLogicHelpers1';
import CacheManager from '../../others/CacheManager';
import type { BibleMinimalInfoType } from './bibleDownloadHelpers';
import type { BibleInfoType } from './BibleDataReader';
import { getAllLocalBibleInfoList } from './bibleDownloadHelpers';
import { unlocking } from '../../server/unlockingHelpers';
import { getSetting, setSetting } from '../settingHelpers';
import { getBibleModelInfo, modelNewLinerInfo } from './bibleModelHelpers';
import { getBibleLocale, getLangDataFromBibleKey } from './bibleStyleHelpers';
import type { BibleRangeTokensType } from './bibleReferenceTokenizer';
import {
    checkHasBibleRangeReference,
    normalizeBibleReferenceText,
    toBibleDigitPattern,
    tokenizeBibleRangeReference,
} from './bibleReferenceTokenizer';

export async function toInputText(
    bibleKey: string,
    book?: string | null,
    chapter?: number | null,
    verseStart?: number | null,
    verseEnd?: number | null,
    // Written only when it is a later chapter: `verseEnd` is then its verse.
    chapterEnd?: number | null,
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
    if (chapterEnd && chapterEnd > chapter && verseEnd) {
        // 1 John 1:1-2:3
        text += `-${await toLocaleNumBible(bibleKey, chapterEnd)}`;
        text += `:${await toLocaleNumBible(bibleKey, verseEnd)}`;
        return text;
    }
    if (!verseEnd || verseEnd === verseStart) {
        // 1 John 1:1
        return text;
    }
    text += `-${await toLocaleNumBible(bibleKey, verseEnd)}`;
    // 1 John 1:1-2
    return text;
}

/**
 * The digits the Bible's OWN data asks for — highest priority, above the
 * language's digits and then English. `null` when it has none, or when they are
 * the plain 0→0 … 9→9 an XML import fills in by default, so a Bible that never
 * set its digits still reads in its language's (a Khmer Bible in Khmer).
 */
export function getBibleNumList(bibleInfo: BibleInfoType | null) {
    if (bibleInfo === null) {
        return null;
    }
    const { numList, numbersMap } = bibleInfo;
    if (numList === undefined && numbersMap === undefined) {
        return null;
    }
    const digits = Array.from({ length: 10 }, (_, i) => {
        return numList?.[i] || numbersMap?.[`${i}`] || `${i}`;
    });
    if (digits.every((digit, i) => digit === `${i}`)) {
        return null;
    }
    return digits;
}

const toLocaleNumCache = new CacheManager<string>(10);
export async function toLocaleNumBible(bibleKey: string, n: number | null) {
    const cacheKey = `${bibleKey}:${n}`;
    const cached = await toLocaleNumCache.get(cacheKey);
    if (cached !== null) {
        return cached;
    }
    if (typeof n !== 'number') {
        return n;
    }
    const numList = getBibleNumList(await getBibleInfo(bibleKey));
    let localeNum: string | null = null;
    if (numList !== null) {
        localeNum = toStringNum(numList, n);
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

const localeNumCache = new CacheManager<number | null>(10);
export async function fromLocaleNumBible(bibleKey: string, localeNum: string) {
    const cacheKey = `${bibleKey}:${localeNum}`;
    if (await localeNumCache.has(cacheKey)) {
        return localeNumCache.get(cacheKey);
    }
    const numList = getBibleNumList(await getBibleInfo(bibleKey));
    let num: number | null = null;
    if (numList !== null) {
        num = fromStringNum(numList, localeNum);
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
    // One item even across chapters: its target carries `chapterEnd`.
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
    const chapterCount = getModelChapterCount(bookKey);
    if (chapterNum === null || chapterNum < 1 || chapterNum > chapterCount) {
        return null;
    }
    return chapterNum;
}

const verseCountCacher = new CacheManager<number>(10);
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

// "Psalm 23:1" typed into a Khmer Bible: no Khmer book is called "Psalm",
// but the model's own (English) name is, and every Bible shares the model's
// book keys. Tried LAST, so a Bible's own names always win.
function modelBookToKey(book: string) {
    const lowerBook = book.trim().toLocaleLowerCase();
    if (!lowerBook) {
        return null;
    }
    for (const [bookKey, modelBook] of Object.entries(getModelKeyBookMap())) {
        if (modelBook.toLocaleLowerCase() === lowerBook) {
            return bookKey;
        }
    }
    return null;
}

// "Psalms 23:1" (no such book) => "23:1": the part of an input no book
// matched that was already a chapter, or a chapter and verses, so picking the
// book it was meant to be does not throw that part away. Digits of any
// script (`\p{Nd}`), so a Khmer `២៣:១` is kept too, and a range across
// chapters (`23:1-24:3`) whole.
const TRAILING_REFERENCE_REGEX =
    /\s(\p{Nd}+(?::\p{Nd}*)?(?:-(?:\p{Nd}+(?::\p{Nd}*)?)?)?)$/u;
export function toTrailingReference(guessingBook: string | null) {
    if (!guessingBook) {
        return null;
    }
    const matches = TRAILING_REFERENCE_REGEX.exec(guessingBook.trim());
    return matches?.[1] ?? null;
}

/**
 * The book a typed name means: the Bible's own name for it, then the
 * language's other spellings of that name (ពេត្រុសទី១ => ១ ពេត្រុស), then the
 * model's English name.
 */
async function resolveBibleBookKey(bibleKey: string, book: string) {
    const bookKey = await bookToKey(bibleKey, book);
    if (bookKey !== null) {
        return bookKey;
    }
    const langData = await getLangDataFromBibleKey(bibleKey);
    if (langData === null) {
        return null;
    }
    for (const transformedBook of langData.transformBibleBookName(book)) {
        const transformedBookKey = await bookToKey(bibleKey, transformedBook);
        if (transformedBookKey !== null) {
            return transformedBookKey;
        }
    }
    return modelBookToKey(book);
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
    const bookKey = await resolveBibleBookKey(bibleKey, book);
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

// `JHN 1:2-3:4`: a range typed with the book's KEY, which only `keyToBook`
// knows — the same fallback the legacy key patterns below give a key.
async function resolveRangeBookKey(bibleKey: string, book: string) {
    const bookKey = await resolveBibleBookKey(bibleKey, book);
    if (bookKey !== null) {
        return bookKey;
    }
    if (/^[123A-Z]{3}$/.test(book) && (await keyToBook(bibleKey, book))) {
        return book;
    }
    return null;
}

async function parseVerseNum(
    bibleKey: string,
    verse: string | null,
    verseCount: number,
) {
    if (verse === null) {
        return null;
    }
    const verseNum = await fromLocaleNumBible(bibleKey, verse);
    if (verseNum === null || verseNum < 1 || verseNum > verseCount) {
        return null;
    }
    return verseNum;
}

/**
 * A range form (`bibleReferenceTokenizer`) as ONE item, crossing chapters
 * when it does. Reads at most the start and the end chapter.
 *
 * Out-of-range numbers fall back the way the legacy parser's do — a start
 * verse to 1, an end verse to its chapter's last — and an end chapter past
 * the book to the book's last verse. An end chapter BEFORE the start one is
 * not a range at all: the start chapter runs to its end.
 */
async function transformExtractedRange(
    bibleKey: string,
    tokens: BibleRangeTokensType,
): Promise<ExtractedBibleResult | null> {
    const bookKey = await resolveRangeBookKey(bibleKey, tokens.book);
    if (bookKey === null) {
        return null;
    }
    const result = genExtractedBible();
    result.bookKey = bookKey;
    const modelChapterCount = getModelChapterCount(bookKey);
    let { chapter, verseStart, chapterEnd, verseEnd } = tokens;
    if (tokens.isWithoutColon && modelChapterCount === 1) {
        // `Jude 1-3`: a one-chapter book is cited by its verses.
        verseStart = chapter;
        verseEnd = chapterEnd;
        chapter = '1';
        chapterEnd = null;
    }
    const chapterNum = await parseChapterFromGuessing(
        bibleKey,
        bookKey,
        chapter,
    );
    if (chapterNum === null) {
        result.guessingChapter = chapter;
        return result;
    }
    const verseCount = await getVersesCount(bibleKey, bookKey, chapterNum);
    if (verseCount === null) {
        result.guessingChapter = chapter;
        return result;
    }
    result.chapter = chapterNum;
    const verseStartNum =
        (await parseVerseNum(bibleKey, verseStart, verseCount)) ?? 1;
    const genResult = (
        newVerseStart: number,
        newVerseEnd: number,
        newChapterEnd?: number,
    ) => {
        result.bibleItem = BibleItem.fromData(
            bibleKey,
            bookKey,
            chapterNum,
            newVerseStart,
            newVerseEnd,
            newChapterEnd,
        );
        return result;
    };
    let chapterEndNum =
        chapterEnd === null
            ? chapterNum
            : await fromLocaleNumBible(bibleKey, chapterEnd);
    if (chapterEndNum === null || chapterEndNum < chapterNum) {
        return genResult(verseStartNum, verseCount);
    }
    const isPastBook = chapterEndNum > modelChapterCount;
    if (isPastBook) {
        chapterEndNum = modelChapterCount;
    }
    if (chapterEndNum === chapterNum) {
        const verseEndNum = isPastBook
            ? verseCount
            : ((await parseVerseNum(bibleKey, verseEnd, verseCount)) ??
              verseCount);
        if (verseEndNum < verseStartNum) {
            // The legacy rule for an end before the start: the whole chapter.
            return genResult(1, verseCount);
        }
        return genResult(verseStartNum, verseEndNum);
    }
    const endVerseCount = await getVersesCount(
        bibleKey,
        bookKey,
        chapterEndNum,
    );
    if (endVerseCount === null) {
        return genResult(verseStartNum, verseCount);
    }
    const verseEndNum = isPastBook
        ? endVerseCount
        : ((await parseVerseNum(bibleKey, verseEnd, endVerseCount)) ??
          endVerseCount);
    return genResult(verseStartNum, verseEndNum, chapterEndNum);
}

export async function getBibleDigitPattern(bibleKey: string) {
    return toBibleDigitPattern(getBibleNumList(await getBibleInfo(bibleKey)));
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
            const [_, bookKey, chapter, verseStart, verseEnd] = matches;
            const book = await keyToBook(bibleKey, bookKey);
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
            const [_, bookKey, chapter, verseStart] = matches;
            const book = await keyToBook(bibleKey, bookKey);
            if (book === null) {
                return null;
            }
            // One verse, like "1 John 1:1" above: with no end the passage ran
            // to the chapter's last verse, so a copied full key (`MRK 4:39`)
            // pasted back into the box read as Mark 4:39-41.
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
    // "2JN 10"
    [
        String.raw`^([123A-Z]{3})\s(\d+)$`,
        async (bibleKey, matches) => {
            if (matches.length !== 3) {
                return null;
            }
            const [_, bookKey, chapter] = matches;
            const book = await keyToBook(bibleKey, bookKey);
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
            const [_, bookKey] = matches;
            const book = await keyToBook(bibleKey, bookKey);
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
} | null>(10);
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
    const digitPattern = await getBibleDigitPattern(bibleKey);
    // The range forms first: the first legacy pattern would otherwise take
    // `John 1:2-3:4` as verses 2 to "3:4" of chapter 1.
    const rangeTokens = tokenizeBibleRangeReference(cleanText, digitPattern);
    if (rangeTokens !== null) {
        const result = await transformExtractedRange(bibleKey, rangeTokens);
        if (result !== null) {
            return { result, bibleKey, inputText, oldInputText, time };
        }
    }
    // `(KJV) John 1:2-3:4`, `John 1:2-3:4 niv`: a range in a version named
    // beside it. Only a text holding a RANGE is redirected here, so every
    // legacy form keeps the answer it has always given.
    if (
        rangeTokens !== null ||
        checkHasBibleRangeReference(cleanText, digitPattern)
    ) {
        const extractedBibleKeyResult = await attemptExtractBibleKey(inputText);
        if (extractedBibleKeyResult !== null) {
            const restText = normalizeBibleReferenceText(
                extractedBibleKeyResult.inputText,
                digitPattern,
            );
            if (tokenizeBibleRangeReference(restText, digitPattern) !== null) {
                return extractBibleTitle(
                    extractedBibleKeyResult.bibleKey,
                    extractedBibleKeyResult.inputText,
                    time,
                );
            }
        }
    }
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
        const locale = await getBibleLocale(bibleKey);
        const lang = await getLangDataAsync(locale);
        if (lang !== null) {
            cleanText = lang.sanitizeText(cleanText);
        }
        // Only AFTER the passes above, and only between numbers: `John
        // 18.33–19.16` => `John 18:33-19:16`, nothing a legacy form reads.
        cleanText = normalizeBibleReferenceText(
            cleanText,
            await getBibleDigitPattern(bibleKey),
        );
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
